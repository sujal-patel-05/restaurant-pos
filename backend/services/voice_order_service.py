"""
Voice Order Service — The core processing pipeline.
Whisper transcription -> Groq LLM parsing -> rapidfuzz menu matching
"""
import json
import time
import logging
import tempfile
import os
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class VoiceOrderService:
    """Processes voice orders through the Whisper -> Groq -> FuzzyMatch pipeline."""

    @staticmethod
    def get_menu_context(db: Session, restaurant_id: str) -> tuple[list[dict], list[str]]:
        """Get menu items and names for context."""
        from models import MenuItem, MenuCategory

        items = (
            db.query(MenuItem)
            .filter(MenuItem.restaurant_id == restaurant_id, MenuItem.is_available == True)
            .all()
        )

        menu_data = []
        menu_names = []
        for item in items:
            cat_name = ""
            if item.category:
                cat_name = item.category.name
            menu_data.append({
                "id": item.id,
                "name": item.name,
                "category": cat_name,
                "price": float(item.price),
                "description": item.description or "",
            })
            menu_names.append(item.name)

        return menu_data, menu_names

    @staticmethod
    def transcribe_audio(audio_path: str, menu_names: list[str]) -> dict:
        """Step 1: Transcribe audio using local Whisper model."""
        from services.whisper_engine import whisper_engine

        if not whisper_engine.is_loaded:
            raise RuntimeError("Whisper model not loaded yet. Please wait for startup.")

        result = whisper_engine.transcribe(audio_path, menu_items=menu_names)
        return result

    @staticmethod
    def parse_with_groq(transcript: str, menu_data: list[dict]) -> list[dict]:
        """Step 2: Parse transcript into structured items using Sarvam AI LLM (primary) or Groq (fallback)."""
        import httpx
        import os
        from config import settings

        # Build menu context string
        menu_str = "\n".join(
            [f"- {item['name']} ({item['category']}) - Rs.{item['price']}" for item in menu_data]
        )

        prompt = f"""You are a restaurant order parser. Given a customer's spoken order and the restaurant menu, extract the ordered items as a JSON array.

RESTAURANT MENU:
{menu_str}

CUSTOMER SAID: "{transcript}"

Rules:
- Return ONLY a valid JSON array, no explanation, no markdown, no code blocks
- Each item: {{"item_name": "string", "quantity": integer, "special_instruction": "string or null"}}
- "a pizza" = quantity 1, "couple of" = 2, "one/two/three" = 1/2/3
- Modifiers like "extra spicy", "no onion" go into special_instruction
- Match item names to the closest menu item name
- If unsure about quantity, default to 1

Respond with ONLY the JSON array:"""

        # Try Sarvam AI Chat Completion first
        sarvam_key = os.getenv("SARVAM_API_KEY", "")
        if sarvam_key:
            try:
                logger.info("[VOICE] Parsing with Sarvam AI LLM...")
                print("[VOICE] Parsing with Sarvam AI LLM...")
                response = httpx.post(
                    "https://api.sarvam.ai/v1/chat/completions",
                    headers={
                        "api-subscription-key": sarvam_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "sarvam-m",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                        "max_tokens": 1000,
                    },
                    timeout=15.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    raw_response = data["choices"][0]["message"]["content"].strip()
                    print(f"[VOICE-SARVAM] Raw LLM response: {raw_response}")

                    # Strip markdown code block markers if present
                    if raw_response.startswith("```"):
                        lines = raw_response.split("\n")
                        lines = [l for l in lines if not l.strip().startswith("```")]
                        raw_response = "\n".join(lines)

                    parsed = json.loads(raw_response)
                    if not isinstance(parsed, list):
                        parsed = [parsed]
                    print(f"[VOICE-SARVAM] ✅ Parsed {len(parsed)} items")
                    return parsed
                else:
                    print(f"[VOICE-SARVAM] ❌ API error {response.status_code}: {response.text[:200]}")
            except Exception as e:
                print(f"[VOICE-SARVAM] ❌ Parse failed: {e}, trying Groq fallback...")

        # Fallback: Groq LLM
        try:
            from groq import Groq
            groq_key = getattr(settings, 'GROQ_API_KEY', None)
            if groq_key:
                logger.info("[VOICE] Falling back to Groq LLM parsing...")
                print("[VOICE] Falling back to Groq LLM parsing...")
                client = Groq(api_key=groq_key)
                response = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=1000,
                )
                raw_response = response.choices[0].message.content.strip()

                if raw_response.startswith("```"):
                    lines = raw_response.split("\n")
                    lines = [l for l in lines if not l.strip().startswith("```")]
                    raw_response = "\n".join(lines)

                parsed = json.loads(raw_response)
                if not isinstance(parsed, list):
                    parsed = [parsed]
                return parsed
        except Exception as e:
            logger.error(f"[VOICE] Groq fallback also failed: {e}")

        return []

    @staticmethod
    def fuzzy_match_items(parsed_items: list[dict], menu_data: list[dict]) -> list[dict]:
        """Step 3: Fuzzy match parsed item names to actual menu items."""
        from rapidfuzz import process, fuzz

        menu_names = [item["name"] for item in menu_data]
        menu_lookup = {item["name"]: item for item in menu_data}

        matched = []
        for parsed in parsed_items:
            item_name = parsed.get("item_name", "")
            quantity = parsed.get("quantity", 1)
            special = parsed.get("special_instruction")

            if not item_name:
                continue

            # Find best match
            result = process.extractOne(
                item_name,
                menu_names,
                scorer=fuzz.token_sort_ratio,
            )

            if result:
                match_name, score, _idx = result
                menu_item = menu_lookup[match_name]

                # Confidence scoring
                if score >= 85:
                    confidence_label = "HIGH"
                elif score >= 65:
                    confidence_label = "MEDIUM"
                else:
                    confidence_label = "LOW"

                matched.append({
                    "menu_item_id": menu_item["id"],
                    "name": menu_item["name"],
                    "category": menu_item["category"],
                    "qty": max(1, int(quantity)),
                    "price": menu_item["price"],
                    "total": round(menu_item["price"] * max(1, int(quantity)), 2),
                    "special_instruction": special,
                    "confidence": round(score / 100, 2),
                    "confidence_label": confidence_label,
                    "original_speech": item_name,
                })

        return matched

    @staticmethod
    def process_voice_order(
        db: Session,
        audio_path: str,
        session_id: str,
        table_id: str,
        restaurant_id: str,
    ) -> dict:
        """
        Full pipeline: Whisper -> Groq -> FuzzyMatch -> save log.
        Returns parsed result for customer confirmation.
        """
        from models.table_session import VoiceOrderLog
        import uuid

        start = time.time()

        # Get menu context
        menu_data, menu_names = VoiceOrderService.get_menu_context(db, restaurant_id)

        if not menu_data:
            return {"error": "No menu items available", "items": []}

        # Step 1: Transcribe
        whisper_result = VoiceOrderService.transcribe_audio(audio_path, menu_names)
        transcript = whisper_result["text"]

        if not transcript or transcript.strip() == "":
            # Check if it was a hallucination
            if whisper_result.get("hallucination"):
                return {
                    "error": "No speech detected. Please hold the mic button, speak your order clearly, then release.",
                    "transcript": "",
                    "items": [],
                }
            return {
                "error": "Could not understand audio. Please speak clearly and try again.",
                "transcript": "",
                "items": [],
            }

        logger.info(f"[VOICE] Transcript: '{transcript}'")
        print(f"[VOICE] Transcript: '{transcript}'")

        # Step 2: Parse with Groq
        parsed_items = VoiceOrderService.parse_with_groq(transcript, menu_data)

        if not parsed_items:
            return {
                "error": f"Could not identify menu items from: \"{transcript}\". Please try again.",
                "transcript": transcript,
                "items": [],
            }

        # Step 3: Fuzzy match
        matched_items = VoiceOrderService.fuzzy_match_items(parsed_items, menu_data)

        processing_time = int((time.time() - start) * 1000)

        # Calculate average confidence
        confidences = [item["confidence"] for item in matched_items]
        avg_confidence = round(sum(confidences) / len(confidences), 2) if confidences else 0

        # Save voice order log (training data — saved even if not confirmed)
        log = VoiceOrderLog(
            id=str(uuid.uuid4()),
            session_id=session_id,
            table_id=table_id,
            audio_file_path=audio_path,
            raw_transcript=transcript,
            parsed_json=json.dumps(parsed_items),
            matched_json=json.dumps(matched_items),
            confidence_avg=avg_confidence,
            processing_time_ms=processing_time,
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        return {
            "log_id": log.id,
            "transcript": transcript,
            "items": matched_items,
            "confidence_avg": avg_confidence,
            "processing_time_ms": processing_time,
        }
