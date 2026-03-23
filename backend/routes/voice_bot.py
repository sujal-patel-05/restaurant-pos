"""
Voice Bot — Hero-Level AI Waiter "Eva"

This is the HERO FEATURE: a customer "calls" the restaurant via a browser link,
and "Eva" — an AI hostess — takes their order conversationally, just like a
real human waiter on a phone call. She greets warmly, suggests dishes, handles
modifications, confirms, and places the order + generates KOTs automatically.

Key Capabilities:
  • Human-like Hinglish personality with filler words (Ji, Bilkul, Zaroor)
  • Cumulative order memory across conversation turns
  • Add / modify / remove items mid-conversation
  • Smart upselling & complementary suggestions
  • Time-based dynamic greetings
  • Graceful unavailable-item handling with alternatives
  • Estimated prep-time on confirmation

Conversation Flow (State Machine):
  GREETING    → Eva greets with warmth
  LISTENING   → Customer speaks, bot transcribes
  PROCESSING  → Eva parses items & responds
  CONFIRMING  → Waiting for "haan" / "yes"
  CONFIRMED   → Order + KOTs generated
  DONE        → Warm closing

WebSocket Protocol:
  Client → Server:  binary audio chunks (WebM/Opus)
  Server → Client:  JSON messages:
    { "type": "state",      "state": "greeting|listening|..." }
    { "type": "bot_audio",  "audio": "<base64 WAV>", "text": "..." }
    { "type": "transcript", "text": "customer said..." }
    { "type": "order",      "items": [...], "total": 123 }
    { "type": "confirmed",  "order_id": "...", "message": "..." }
    { "type": "error",      "message": "..." }
"""
import os
import json
import uuid
import asyncio
import subprocess
import logging
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from database import SessionLocal
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/voice-bot", tags=["Voice Bot"])


# ═══════════════════════════════════════════════════════════════════════════════
# AI Services: STT, TTS, LLM
# ═══════════════════════════════════════════════════════════════════════════════

async def sarvam_stt(audio_path: str, menu_hint: str = "") -> str:
    """Transcribe audio using Sarvam AI STT with Groq Whisper fallback.
    
    menu_hint: comma-separated menu item names passed as context to improve
    food-word recognition accuracy (e.g. 'Butter Chicken, Paneer Tikka').
    """
    import httpx

    sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
    if sarvam_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                with open(audio_path, "rb") as f:
                    form_data = {
                        "language_code": "hi-IN",
                        "model": "saaras:v3",
                        "with_disfluencies": "false",  # Remove ums/ahs for cleaner text
                    }
                    resp = await client.post(
                        "https://api.sarvam.ai/speech-to-text",
                        headers={"api-subscription-key": sarvam_key},
                        files={"file": f},
                        data=form_data
                    )
                
                if resp.status_code == 200:
                    transcript = resp.json().get("transcript", "")
                    print(f"[EVA-STT] ✅ Sarvam Result: {transcript}")
                    return transcript
                else:
                    print(f"[EVA-STT] ❌ API Error {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"[EVA-STT] ❌ Exception: {e}")

    # Fallback: Groq Whisper — inject menu items as prompt for better food-word accuracy
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            groq_client = Groq(api_key=settings.GROQ_API_KEY)
            # The prompt primes Whisper with known menu vocabulary so it transcribes
            # food names correctly instead of hallucinating phonetically similar words.
            whisper_prompt = (
                f"Menu items: {menu_hint}. " if menu_hint else ""
            ) + "Customer is ordering food in Hinglish (Hindi + English mix)."
            with open(audio_path, "rb") as f:
                result = groq_client.audio.transcriptions.create(
                    file=("audio.wav", f.read()),
                    model="whisper-large-v3-turbo",
                    language="hi",
                    prompt=whisper_prompt,
                )
            transcript = result.text.strip() if result.text else ""
            print(f"[EVA-STT] ✅ Groq Whisper Result: {transcript}")
            return transcript
        except Exception as e:
            logger.error(f"[EVA-STT] Groq fallback error: {e}")
    return ""


async def sarvam_tts(text: str, lang: str = "hi-IN") -> str | None:
    """Generate warm, natural speech using Sarvam TTS (Meera voice)."""
    import httpx

    sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
    if not sarvam_key:
        print("[EVA-TTS] ❌ No SARVAM_API_KEY found!")
        return None

    print(f"[EVA-TTS] Generating speech for: {text[:80]}...")
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"api-subscription-key": sarvam_key, "Content-Type": "application/json"},
                json={
                    "inputs": [text[:1500]],
                    "target_language_code": lang,
                    "model": "bulbul:v2",
                    "speaker": "anushka",
                    "pitch": 0,
                    "pace": 1.1,
                    "loudness": 1.5,
                    "enable_preprocessing": True,
                    "sample_rate": 16000,
                },
            )
            print(f"[EVA-TTS] API status: {resp.status_code}")
            if resp.status_code == 200:
                audios = resp.json().get("audios", [])
                if audios:
                    print(f"[EVA-TTS] ✅ Got audio, length: {len(audios[0])} chars")
                    return audios[0]
                else:
                    print(f"[EVA-TTS] ⚠️ 200 but no audios in response: {resp.text[:200]}")
            else:
                print(f"[EVA-TTS] ❌ API error {resp.status_code}: {resp.text[:300]}")
    except Exception as e:
        print(f"[EVA-TTS] ❌ Exception: {e}")
    return None


async def sarvam_llm(system_prompt: str, user_msg: str) -> str:
    """Call Sarvam LLM (primary) or Groq (fallback) for Eva's responses."""
    import httpx

    sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
    if sarvam_key:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://api.sarvam.ai/v1/chat/completions",
                    headers={"api-subscription-key": sarvam_key, "Content-Type": "application/json"},
                    json={
                        "model": "sarvam-m",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_msg},
                        ],
                        "max_tokens": 700, "temperature": 0.15,
                    },
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"[EVA-LLM] Sarvam error: {e}")

    # Groq fallback
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            groq_client = Groq(api_key=settings.GROQ_API_KEY)
            response = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg},
                ],
                max_tokens=700, temperature=0.15,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"[EVA-LLM] Groq error: {e}")
    return ""


def convert_to_wav(webm_path: str, wav_path: str) -> bool:
    """Convert WebM/Opus to WAV using ffmpeg."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", webm_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
            capture_output=True, text=True, timeout=10, shell=False,
        )
        success = result.returncode == 0 and os.path.exists(wav_path) and os.path.getsize(wav_path) > 500
        if not success:
            print(f"[EVA-FFMPEG] ❌ Convert failed. Return code: {result.returncode}")
            if result.stderr:
                print(f"[EVA-FFMPEG] stderr: {result.stderr[:300]}")
        else:
            wav_size = os.path.getsize(wav_path)
            print(f"[EVA-FFMPEG] ✅ Converted to WAV: {wav_size} bytes")
        return success
    except Exception as e:
        print(f"[EVA-FFMPEG] ❌ Exception: {e}")
        return False


def strip_think_tags(text: str) -> str:
    """Remove <think>...</think> reasoning tags from LLM responses."""
    import re
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    # Also handle partial or broken tags just in case
    cleaned = cleaned.replace("<think>", "").replace("</think>", "").strip()
    return cleaned


def get_time_greeting() -> str:
    """Dynamic time-based Hindi greeting."""
    hour = datetime.now().hour
    if hour < 12:
        return "Good morning"
    elif hour < 17:
        return "Good afternoon"
    else:
        return "Good evening"


def fuzzy_match_menu(name: str, menu_data: list) -> dict | None:
    """Fuzzy match an item name to the menu. Returns menu item dict or None."""
    from difflib import SequenceMatcher

    menu_lookup = {m["name"]: m for m in menu_data}
    menu_lower = {m["name"].lower(): m["name"] for m in menu_data}

    # Exact match
    if name in menu_lookup:
        return menu_lookup[name]
    # Case-insensitive
    if name.lower() in menu_lower:
        return menu_lookup[menu_lower[name.lower()]]
    # Fuzzy
    best_score, best_match = 0, None
    name_lower = name.lower()
    for mn in menu_lookup:
        # Primary: sequence match
        score = SequenceMatcher(None, name_lower, mn.lower()).ratio()
        # Bonus: if the spoken name is a substring of the menu name or vice-versa
        if name_lower in mn.lower() or mn.lower() in name_lower:
            score = max(score, 0.70)
        if score > best_score:
            best_score, best_match = score, mn
    # Raised from 0.55 → 0.65 to avoid wrong item matches
    if best_score >= 0.65 and best_match:
        return menu_lookup[best_match]
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# Eva's Personality Prompts
# ═══════════════════════════════════════════════════════════════════════════════

def build_order_prompt(restaurant_name: str, menu_list: str,
                       conversation_history: list, current_order: list) -> str:
    """Build the system prompt for Eva — the AI hostess."""

    history_text = "\n".join(
        f"{'Customer' if h['role'] == 'customer' else 'Eva'}: {h['text']}"
        for h in conversation_history
    )

    current_order_text = ""
    if current_order:
        current_order_text = "CURRENT ORDER SO FAR:\n" + "\n".join(
            f"  - {i['qty']}x {i['name']} (₹{i['price']} each)" for i in current_order
        )
        total = sum(i['price'] * i['qty'] for i in current_order)
        current_order_text += f"\n  SUBTOTAL: ₹{int(total)}"

    return f"""You are EVA, a warm, friendly, and experienced AI hostess/waiter at {restaurant_name}.
You are talking to a customer on a PHONE CALL (voice). You take orders just like a REAL HUMAN waiter.

YOUR PERSONALITY:
- You are warm, cheerful, and professional — like a 5-star restaurant hostess
- You speak in natural Hinglish (Hindi + English mix), the way real Indians talk on phone
- You use natural filler words: "Ji", "Bilkul", "Zaroor", "Ekdum", "Accha"
- You are FAST and EFFICIENT — don't give long speeches. Keep responses 1-3 sentences MAX
- You sound like a REAL PERSON, not a robot. No "Main ek AI hoon" type disclaimers ever
- You subtly suggest popular/complementary items (e.g., "Butter Naan ke saath Butter Chicken try karenge?")
- CRITICAL: You ONLY accept items that are EXACTLY on the menu. If a customer asks for ANYTHING else (like "pizza", "burger", "coke" if not on the menu), you MUST politely refuse. "Maaf kijiye, humare pass [item name] nahi hai. Aap [alternative on menu] try kar sakte hain."

MENU (ONLY these items can be ordered):
{menu_list}

{current_order_text}

FULL CONVERSATION:
{history_text}

RESPOND IN STRICT JSON ONLY:
{{
  "action": "take_order" | "modify_order" | "need_info" | "suggest" | "chitchat",
  "items": [{{"name": "exact menu item name", "qty": number}}],
  "remove_items": ["items to remove from current order"],
  "unavailable": ["items customer asked for but not on menu"],
  "suggestion": "optional: a complementary item suggestion",
  "response_text": "Eva's spoken response in natural Hinglish. MUST be short, warm, human-like.",
  "needs_more_info": false,
  "ready_to_confirm": false
}}

CRITICAL RULES:
1. Match item names EXACTLY to what's on the MENU. Handle common variations:
   kaafi/coffee→Coffee, biriyani→Biryani, roti/chapati→Roti, naan→Naan, daal→Dal
2. **STRICT MENU RULE**: If the customer asks for ANY item NOT explicitly listed in the MENU section above, you MUST put it in the `unavailable` array AND you MUST tell them in `response_text` that it is not available. Do NOT add it to `items`!
3. Hindi number words: ek→1, do→2, teen→3, char→4, paanch→5, chhe→6, one→1, two→2, three→3
4. Default quantity is 1 if not specified
5. If customer says "aur" (more) or adds items, set action="modify_order" and include ONLY the NEW items
6. If customer says "hatao"/"remove"/"cancel [item]", put those in remove_items
7. If customer says "bas itna" / "that's all" / "confirm" / "done", set ready_to_confirm=true
7. response_text MUST be in Hinglish, SHORT (max 2-3 sentences), and include total price
8. If something is unclear, ask ONCE politely — don't keep repeating
9. ALWAYS include total price when you have items
10. If customer chats casually ("kaisa hai", "weather"), reply briefly and redirect to order
11. For suggestion: only suggest ONCE, not repeatedly. Only suggest items FROM the menu"""


def build_confirm_prompt(restaurant_name: str) -> str:
    """Build the system prompt for Eva's confirmation handling."""
    return f"""You are EVA, AI hostess at {restaurant_name}. The customer was asked to confirm their order.

Determine the customer's intent from what they said. Respond in STRICT JSON only:
{{
  "confirmed": true/false,
  "wants_changes": false,
  "wants_to_add": false,
  "response_text": "Eva's warm response in Hinglish"
}}

DETECTION RULES:
- CONFIRM words: "haan", "ha", "yes", "confirm", "theek", "sahi", "bilkul", "ok", "okay",
  "right", "sure", "done", "kar do", "de do", "lagao", "place karo", "bas", "ban gaya",
  "हाँ", "हां", "जी", "जी हाँ", "ठीक", "ठीक है", "कर दो", "बिल्कुल", "कन्फर्म", "श्योर",
  "ओके", "confirm karo", "order laga do", "final hai"
- CHANGE words: "nahi", "no", "cancel", "change", "modify", "hatao", "galat", "wrong", "ruk", "ruko",
  "नहीं", "कैंसल", "बदलो", "हटाओ", "गलत", "रुको"
- ADD words: "aur", "add", "ek aur", "ye bhi", "aur chahiye",
  "और", "और चाहिए", "एक और", "ये भी"

RESPONSE PERSONALITY:
- If confirmed: "Bilkul ji! Aapka order place kar rahi hoon. Bas 2 second..." (warm, excited)
- If wants changes: "Koi baat nahi ji! Bataiye kya change karna hai?" (understanding, patient)
- If wants to add: "Zaroor! Bataiye aur kya add karein?" (enthusiastic)
- Keep it SHORT — max 1-2 sentences"""


# ═══════════════════════════════════════════════════════════════════════════════
# WebSocket: Eva Voice Bot Call
# ═══════════════════════════════════════════════════════════════════════════════

@router.websocket("/call")
async def voice_bot_call(ws: WebSocket, table_id: str = Query("T1")):
    """
    Hero-level conversational AI voice bot — "Eva".
    Customer connects via WebSocket, Eva greets, takes order, confirms, places it.
    """
    await ws.accept()

    # ── Get restaurant + menu from DB ────────────────────────────────────
    db = SessionLocal()
    try:
        from models import MenuItem, Restaurant

        restaurant_id = None
        try:
            from models import Table
            table = db.query(Table).filter(Table.table_number == table_id).first()
            if table:
                restaurant_id = str(table.restaurant_id)
        except:
            pass

        if not restaurant_id:
            restaurant = db.query(Restaurant).first()
            if restaurant:
                restaurant_id = str(restaurant.id)

        if not restaurant_id:
            await ws.send_json({"type": "error", "message": "No restaurant found"})
            await ws.close()
            return

        menu_items = (
            db.query(MenuItem)
            .filter(MenuItem.restaurant_id == restaurant_id, MenuItem.is_available == True)
            .all()
        )
        menu_data = [{"id": str(item.id), "name": item.name, "price": float(item.price)} for item in menu_items]
        menu_list = "\n".join([f"- {m['name']} (₹{m['price']})" for m in menu_data])
        # Comma-separated names passed to STT as vocabulary hint for better food-word accuracy
        menu_hint = ", ".join(m["name"] for m in menu_data)
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        restaurant_name = restaurant.name if restaurant else "Restaurant"

    finally:
        db.close()

    # ── Conversation state ───────────────────────────────────────────────
    state = "greeting"
    conversation_history = []
    current_order = []          # Cumulative order: [{"name", "qty", "menu_item_id", "price"}]
    full_transcript = ""
    suggestion_given = False     # Only suggest once

    tmp_dir = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), "temp_audio")
    os.makedirs(tmp_dir, exist_ok=True)

    # ── Helper: send bot speech ──────────────────────────────────────────
    async def bot_speak(text, new_state=None):
        nonlocal state
        if new_state:
            state = new_state
            await ws.send_json({"type": "state", "state": state})

        # Final cleanup to remove any reasoning tags before speaking/sending
        text = strip_think_tags(text)

        # Use a phonetic version for TTS to avoid "E-V-A" spelling
        import re
        vocal_text = re.sub(r'\bEva\b', 'Evaaa', text)

        print(f"[EVA] 🗣️ Speaking: {text[:80]}...")
        audio_b64 = await sarvam_tts(vocal_text)
        print(f"[EVA] 🔊 TTS result: {'Got audio' if audio_b64 else 'NO AUDIO'}")
        await ws.send_json({
            "type": "bot_audio",
            "audio": audio_b64,
            "text": text,
        })

    # ── Helper: send current order to frontend ───────────────────────────
    async def send_order_update():
        total = sum(i["price"] * i["qty"] for i in current_order)
        await ws.send_json({
            "type": "order",
            "items": current_order,
            "unavailable": [],
            "total": round(total, 2),
        })

    # ── GREETING ─────────────────────────────────────────────────────────
    await ws.send_json({"type": "state", "state": "greeting"})

    time_greet = get_time_greeting()
    greeting = (
        f"{time_greet}! {restaurant_name} mein aapka swagat hai! "
        f"Main Eva, aapki hostess hoon aaj ke liye. "
        f"Bataiye, kya mangwaayenge aaj?"
    )
    conversation_history.append({"role": "bot", "text": greeting})
    await bot_speak(greeting, "listening")

    # ── Audio processing loop ────────────────────────────────────────────
    # Frontend uses VAD (Voice Activity Detection) — it records the full
    # sentence, detects silence, then sends ONE complete audio blob.
    # So each binary WS message = one full customer sentence.

    try:
        while True:
            # Use receive() to handle both text and binary frames
            message = await ws.receive()

            if message.get("type") == "websocket.disconnect":
                print("[EVA] Client disconnected")
                break

            # Get binary data
            data = message.get("bytes")
            if not data:
                # Could be a text frame (ignore)
                continue

            print(f"[EVA] 📥 Received audio: {len(data)} bytes")

            # Skip tiny messages (noise / silence)
            if len(data) < 3000:
                print(f"[EVA] ⏭️ Skipping tiny audio ({len(data)} bytes)")
                continue

            # Convert the complete audio blob → WAV → Transcribe
            file_id = uuid.uuid4().hex[:8]
            webm_path = os.path.join(tmp_dir, f"eva_{file_id}.webm")
            wav_path = webm_path.replace(".webm", ".wav")

            try:
                with open(webm_path, "wb") as f:
                    f.write(data)

                if not convert_to_wav(webm_path, wav_path):
                    continue

                # Pass menu_hint so STT AI knows the vocabulary to expect
                transcript = await sarvam_stt(wav_path, menu_hint=menu_hint)

                # Extended noise filter — single words / common noise phrases
                noise_words = {
                    "", "you", "the", "a", "is", "um", "hmm", "oh", "ah", "uh",
                    "ok", "okay", "thank you", "thank you.", "thanks", "thanks.",
                    "bye", "bye.", "hello", "hi", "hey", "haan", "ha",
                    "music", ".", "...", "applause", "[music]", "[applause]",
                }
                if not transcript or transcript.lower().strip().rstrip(".") in noise_words:
                    print(f"[EVA] 🔇 Filtered out noise transcript: '{transcript}'")
                    continue

                full_transcript += (" " + transcript) if full_transcript else transcript
                await ws.send_json({"type": "transcript", "text": transcript})

                print(f"[EVA] 📝 Final Transcript: '{transcript}'")
                conversation_history.append({"role": "customer", "text": transcript})
                print(f"[EVA] Customer [{state}]: {transcript}")

            finally:
                for fp in [webm_path, wav_path]:
                    try: os.remove(fp)
                    except: pass

            # ── STATE: LISTENING — Parse the order ───────────────────────
            if state == "listening":
                await ws.send_json({"type": "state", "state": "processing"})

                system_prompt = build_order_prompt(
                    restaurant_name, menu_list, conversation_history, current_order
                )

                llm_raw = await sarvam_llm(system_prompt, f'Customer just said: "{transcript}"')
                print(f"[EVA] LLM raw: {llm_raw}")

                try:
                    import re
                    # Strip reasoning tags first to avoid issues with JSON parsing
                    cleaned = strip_think_tags(llm_raw)
                    cleaned = cleaned.replace("```json", "").replace("```", "").strip()
                    # Robust JSON extraction: find first { and last }
                    json_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
                    if json_match:
                        cleaned = json_match.group(0)
                        
                    data = json.loads(cleaned)

                    action = data.get("action", "take_order")
                    new_items = data.get("items", [])
                    remove_items = data.get("remove_items", [])
                    unavailable = data.get("unavailable", [])
                    response_text = data.get("response_text", "")
                    needs_more = data.get("needs_more_info", False)
                    ready_to_confirm = data.get("ready_to_confirm", False)
                    suggestion = data.get("suggestion", "")

                    # ── Process new items via fuzzy match ─────────────────
                    for item in new_items:
                        name = item.get("name", "")
                        qty = max(1, int(item.get("qty", 1)))

                        match = fuzzy_match_menu(name, menu_data)
                        if match:
                            # Check if already in order → update qty
                            existing = next((o for o in current_order if o["menu_item_id"] == match["id"]), None)
                            if existing and action == "modify_order":
                                existing["qty"] += qty
                            elif existing and action == "take_order":
                                existing["qty"] = qty  # Replace
                            else:
                                current_order.append({
                                    "name": match["name"],
                                    "qty": qty,
                                    "menu_item_id": match["id"],
                                    "price": match["price"],
                                })
                        elif name:
                            unavailable.append(name)

                    # ── Process removals ──────────────────────────────────
                    for rm_name in remove_items:
                        rm_lower = rm_name.lower()
                        current_order[:] = [
                            o for o in current_order
                            if o["name"].lower() != rm_lower
                        ]

                    # ── Send updated order to frontend ────────────────────
                    await send_order_update()

                    # ── Decide response ───────────────────────────────────
                    if ready_to_confirm and current_order:
                        # Customer said "bas" or "done" — ask for confirmation
                        total = sum(i["price"] * i["qty"] for i in current_order)
                        item_list = ", ".join(f"{i['qty']} {i['name']}" for i in current_order)

                        if not response_text:
                            response_text = (
                                f"Ji bilkul! Aapka order hai: {item_list}. "
                                f"Total hoga {int(total)} rupees. "
                                f"Confirm kar doon?"
                            )

                        state = "confirming"
                        conversation_history.append({"role": "bot", "text": response_text})
                        await bot_speak(response_text, "confirming")

                    elif current_order and not needs_more:
                        total = sum(i["price"] * i["qty"] for i in current_order)
                        item_list = ", ".join(f"{i['qty']} {i['name']}" for i in current_order)

                        # Add suggestion if not given yet
                        suggestion_part = ""
                        if suggestion and not suggestion_given:
                            suggestion_given = True
                            suggestion_part = f" {suggestion} bhi try karenge?"

                        if not response_text:
                            response_text = (
                                f"Ji zaroor! {item_list}, total {int(total)} rupees."
                                f"{suggestion_part} "
                                f"Aur kuch chahiye ya confirm karein?"
                            )

                        if unavailable:
                            # Let LLM response text handle the denial message completely
                            pass

                        conversation_history.append({"role": "bot", "text": response_text})
                        await bot_speak(response_text, "listening")

                    else:
                        # Need more info or no items matched
                        if not response_text:
                            if unavailable:
                                unavail_text = ", ".join(unavailable)
                                response_text = f"Sorry ji, {unavail_text} available nahi hai. Aur kuch bataiye?"
                            else:
                                response_text = "Ji, main sun rahi hoon. Kya order karna chahenge?"

                        conversation_history.append({"role": "bot", "text": response_text})
                        await bot_speak(response_text, "listening")

                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    print(f"[EVA] Parse error: {e}")
                    await bot_speak(
                        "Sorry ji, main samajh nahi paayi. Ek baar phir bataiye kya chahiye?",
                        "listening"
                    )

            # ── STATE: CONFIRMING — Check yes/no ─────────────────────────
            elif state == "confirming":
                system_prompt = build_confirm_prompt(restaurant_name)
                confirm_raw = await sarvam_llm(system_prompt, f'Customer said: "{transcript}"')
                print(f"[EVA] Confirm LLM: {confirm_raw}")

                try:
                    import re
                    # Strip reasoning tags first
                    cleaned = strip_think_tags(confirm_raw)
                    cleaned = cleaned.replace("```json", "").replace("```", "").strip()
                    json_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
                    if json_match:
                        cleaned = json_match.group(0)
                        
                    result = json.loads(cleaned)
                    confirmed = result.get("confirmed", False)
                    wants_changes = result.get("wants_changes", False)
                    wants_to_add = result.get("wants_to_add", False)
                    resp_text = result.get("response_text", "")

                    if confirmed and current_order:
                        # ── ASK FOR CUSTOMER NAME before placing order ─────
                        await ws.send_json({"type": "state", "state": "asking_name"})

                        name_ask = (
                            "Bahut badhiya ji! Order confirm ho raha hai. "
                            "Bas ek last cheez — aapka shubh naam bata dijiye?"
                        )
                        conversation_history.append({"role": "bot", "text": name_ask})
                        await bot_speak(name_ask, "asking_name")
                        state = "asking_name"

                    elif wants_to_add:
                        if not resp_text:
                            resp_text = "Zaroor ji! Bataiye aur kya add karein?"
                        conversation_history.append({"role": "bot", "text": resp_text})
                        await bot_speak(resp_text, "listening")

                    elif wants_changes:
                        if not resp_text:
                            resp_text = "Koi baat nahi ji! Bataiye kya change karna hai?"
                        conversation_history.append({"role": "bot", "text": resp_text})
                        await bot_speak(resp_text, "listening")

                    else:
                        if not resp_text:
                            resp_text = "Ji, confirm karna hai? Haan ya nahi bataiye."
                        await bot_speak(resp_text, "confirming")

                except (json.JSONDecodeError, ValueError) as e:
                    print(f"[EVA] Confirm parse error: {e}")
                    await bot_speak("Confirm karna hai ji? Haan ya nahi bataiye.", "confirming")

            # ── STATE: ASKING_NAME — Extract customer name ────────────────
            elif state == "asking_name":
                # The transcript IS the customer's name (or contains it)
                # Use LLM to cleanly extract just the name
                name_prompt = (
                    "You are a name extractor. The customer just told their name on a phone call. "
                    "Extract ONLY the person's name from what they said. "
                    "They might say 'mera naam Rahul hai' or 'Sujal' or 'I am Priya' etc. "
                    "Respond with ONLY the name in plain text, nothing else. No JSON, no quotes, no explanation. "
                    "If you can't find a name, respond with 'Customer'."
                )
                customer_name = await sarvam_llm(name_prompt, f'Customer said: "{transcript}"')
                customer_name = strip_think_tags(customer_name).strip().strip('"').strip("'").strip()
                if not customer_name or len(customer_name) > 50:
                    customer_name = "Customer"
                
                print(f"[EVA] 👤 Customer name: {customer_name}")

                # ── PLACE THE ORDER + KOT ────────────────────────────────
                await ws.send_json({"type": "state", "state": "confirmed"})

                placing_msg = f"Dhanyavaad {customer_name} ji! Aapka order place kar rahi hoon..."
                conversation_history.append({"role": "bot", "text": placing_msg})
                await bot_speak(placing_msg)

                order_db = SessionLocal()
                try:
                    from models import User
                    from services.order_service import OrderService

                    admin_user = order_db.query(User).filter(User.role == "admin").first()
                    user_id = admin_user.id if admin_user else None

                    order_payload = {
                        "order_type": "dine_in",
                        "order_source": "voice_bot",
                        "table_number": table_id,
                        "items": [
                            {"menu_item_id": i["menu_item_id"], "quantity": i["qty"]}
                            for i in current_order
                        ],
                        "customer_name": customer_name,
                        "special_instructions": f"[Eva AI Call] Customer: {customer_name} | {full_transcript[:200]}"
                    }

                    order_result = OrderService.create_order(
                        order_db, restaurant_id, order_payload, user_id
                    )

                    if order_result.get("success"):
                        order_id = order_result["order_id"]
                        total_amount = order_result["total_amount"]
                        print(f"[RIYA] ✅ Order placed! ID: {order_id}, Total: ₹{total_amount}, Customer: {customer_name}")
                    else:
                        raise Exception(order_result.get("error", "Order failed"))

                except Exception as e:
                    print(f"[RIYA] Order creation error: {e}")
                    await ws.send_json({"type": "error", "message": f"Order failed: {str(e)}"})
                    await bot_speak(
                        "Maafi chahti hoon, order mein thodi problem aa gayi. Ek baar phir try karte hain.",
                        "listening"
                    )
                    continue
                finally:
                    order_db.close()

                await ws.send_json({
                    "type": "confirmed",
                    "order_id": order_id,
                    "total": total_amount,
                    "customer_name": customer_name,
                    "message": f"Order placed for {customer_name}!",
                })

                # Warm closing with KOT confirmation and 20 min ETA
                item_list = ", ".join(f"{i['qty']} {i['name']}" for i in current_order)
                closing = (
                    f"{customer_name} ji, aapka order successfully place ho gaya hai! "
                    f"Aapne order kiya hai: {item_list}. Total {int(total_amount)} rupees. "
                    f"KOT generate ho gaya hai kitchen mein. "
                    f"Approximately 20 minutes mein aapka order ready hoga. "
                    f"Dhanyavaad ji! Enjoy your meal!"
                )
                conversation_history.append({"role": "bot", "text": closing})
                await bot_speak(closing, "done")
                state = "done"

            # ── STATE: DONE ──────────────────────────────────────────────
            elif state == "done":
                await bot_speak(
                    "Aapka order pehle se place ho chuka hai ji. Kuch aur chahiye toh new call kariyega. Dhanyavaad!",
                    "done"
                )


    except WebSocketDisconnect:
        print(f"[RIYA] Client disconnected (table {table_id})")
    except Exception as e:
        print(f"[RIYA] Error: {e}")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except:
            pass
