"""
Voice Bot — AI-powered conversational order-taking bot.

This is the CORE feature: a customer "calls" the restaurant via a browser link,
and an AI voice bot takes their order conversationally, just like a real waiter.

Conversation Flow (State Machine):
  GREETING    → Bot says "Namaste! Aapka order bataiye"
  LISTENING   → Customer speaks, bot transcribes
  PROCESSING  → Bot parses items, responds with confirmation
  CONFIRMING  → Waiting for customer to say "haan" / "yes"
  CONFIRMED   → Order placed, KOTs generated
  DONE        → Call ended

WebSocket Protocol:
  Client → Server:  binary audio chunks (WebM/Opus from MediaRecorder)
  Server → Client:  JSON messages:
    { "type": "state",      "state": "greeting|listening|..." }
    { "type": "bot_audio",  "audio": "<base64 WAV>", "text": "..." }
    { "type": "transcript",  "text": "customer said..." }
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


async def sarvam_stt(audio_path: str) -> str:
    """Transcribe audio using Sarvam AI STT."""
    import httpx

    sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
    if not sarvam_key:
        return ""

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            with open(audio_path, "rb") as f:
                resp = await client.post(
                    "https://api.sarvam.ai/speech-to-text",
                    headers={"api-subscription-key": sarvam_key},
                    data={"model": "saaras:v3", "language_code": "hi-IN", "mode": "transcribe"},
                    files={"file": ("audio.wav", f, "audio/wav")},
                )
            if resp.status_code == 200:
                return resp.json().get("transcript", "").strip()
    except Exception as e:
        logger.error(f"[VBOT-STT] Sarvam error: {e}")

    # Fallback to Groq Whisper
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            groq_client = Groq(api_key=settings.GROQ_API_KEY)
            with open(audio_path, "rb") as f:
                result = groq_client.audio.transcriptions.create(
                    file=("audio.wav", f.read()),
                    model="whisper-large-v3-turbo",
                    language="hi",
                )
            return result.text.strip() if result.text else ""
        except Exception as e:
            logger.error(f"[VBOT-STT] Groq fallback error: {e}")

    return ""


async def sarvam_tts(text: str, lang: str = "hi-IN") -> str | None:
    """Generate speech audio using Sarvam TTS. Returns base64 WAV or None."""
    import httpx

    sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
    if not sarvam_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"api-subscription-key": sarvam_key, "Content-Type": "application/json"},
                json={
                    "inputs": [text[:1500]],
                    "target_language_code": lang,
                    "model": "bulbul:v2",
                    "speaker": "meera",
                    "pitch": 0,
                    "pace": 1.15,
                    "loudness": 1.5,
                    "enable_preprocessing": True,
                    "sample_rate": 16000,
                },
            )
            if resp.status_code == 200:
                audios = resp.json().get("audios", [])
                if audios:
                    return audios[0]
    except Exception as e:
        logger.error(f"[VBOT-TTS] Error: {e}")

    return None


async def sarvam_llm(system_prompt: str, user_msg: str) -> str:
    """Call Sarvam or Groq LLM for conversational responses."""
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
                        "max_tokens": 600, "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"[VBOT-LLM] Sarvam error: {e}")

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
                max_tokens=600, temperature=0.1,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"[VBOT-LLM] Groq error: {e}")

    return ""


def convert_to_wav(webm_path: str, wav_path: str) -> bool:
    """Convert WebM/Opus to WAV using ffmpeg."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", webm_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
            capture_output=True, text=True, timeout=10, shell=True,
        )
        return result.returncode == 0 and os.path.exists(wav_path) and os.path.getsize(wav_path) > 500
    except:
        return False


# ═══════════════════════════════════════════════════════════════════════════
# WebSocket: Full conversational voice bot
# ═══════════════════════════════════════════════════════════════════════════

@router.websocket("/call")
async def voice_bot_call(ws: WebSocket, table_id: str = Query("T1")):
    """
    Full-duplex conversational AI voice bot.
    Customer connects via WebSocket, bot greets them, takes order, confirms, places it.
    """
    await ws.accept()

    # ── Get restaurant + menu from DB ────────────────────────────────────
    db = SessionLocal()
    try:
        from models import MenuItem, Restaurant
        from routes.customer import get_or_create_table_session

        # Try to find restaurant from table session
        restaurant_id = None
        try:
            # Look up table
            from models import Table
            table = db.query(Table).filter(Table.table_number == table_id).first()
            if table:
                restaurant_id = str(table.restaurant_id)
        except:
            pass

        if not restaurant_id:
            # Fallback: use first restaurant
            restaurant = db.query(Restaurant).first()
            if restaurant:
                restaurant_id = str(restaurant.id)

        if not restaurant_id:
            await ws.send_json({"type": "error", "message": "No restaurant found"})
            await ws.close()
            return

        # Fetch menu
        menu_items = (
            db.query(MenuItem)
            .filter(MenuItem.restaurant_id == restaurant_id, MenuItem.is_available == True)
            .all()
        )
        menu_data = [{"id": str(item.id), "name": item.name, "price": float(item.price)} for item in menu_items]
        menu_list = "\n".join([f"- {m['name']} (₹{m['price']})" for m in menu_data])
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        restaurant_name = restaurant.name if restaurant else "Restaurant"

    finally:
        db.close()

    # ── Conversation state ───────────────────────────────────────────────
    state = "greeting"
    conversation_history = []
    parsed_items = []
    full_transcript = ""

    tmp_dir = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), "temp_audio")
    os.makedirs(tmp_dir, exist_ok=True)

    # ── Helper: send bot speech ──────────────────────────────────────────
    async def bot_speak(text, new_state=None):
        nonlocal state
        if new_state:
            state = new_state
            await ws.send_json({"type": "state", "state": state})

        audio_b64 = await sarvam_tts(text)
        await ws.send_json({
            "type": "bot_audio",
            "audio": audio_b64,
            "text": text,
        })

    # ── GREETING ─────────────────────────────────────────────────────────
    await ws.send_json({"type": "state", "state": "greeting"})
    greeting = f"Namaste! {restaurant_name} mein aapka swagat hai. Aap kya order karna chahenge?"
    await bot_speak(greeting, "listening")

    # ── Audio processing loop ────────────────────────────────────────────
    audio_buffer = bytearray()

    try:
        while True:
            data = await ws.receive_bytes()
            audio_buffer.extend(data)

            # Wait for enough audio (~3 seconds)
            if len(audio_buffer) < 24000:
                continue

            # Convert buffer → WAV → Transcribe
            file_id = uuid.uuid4().hex[:8]
            webm_path = os.path.join(tmp_dir, f"vbot_{file_id}.webm")
            wav_path = webm_path.replace(".webm", ".wav")

            try:
                with open(webm_path, "wb") as f:
                    f.write(bytes(audio_buffer))

                if not convert_to_wav(webm_path, wav_path):
                    audio_buffer = bytearray()
                    continue

                transcript = await sarvam_stt(wav_path)

                # Skip empty/noise transcripts
                if not transcript or transcript.lower() in ["", "thank you.", "thanks.", "bye.", "you"]:
                    audio_buffer = bytearray()
                    continue

                full_transcript += (" " + transcript) if full_transcript else transcript
                await ws.send_json({"type": "transcript", "text": transcript})

                conversation_history.append({"role": "customer", "text": transcript})
                print(f"[VBOT] Customer [{state}]: {transcript}")

            finally:
                for f in [webm_path, wav_path]:
                    try: os.remove(f)
                    except: pass
                audio_buffer = bytearray()

            # ── State machine response ───────────────────────────────────
            if state == "listening":
                # Parse the order from transcript
                await ws.send_json({"type": "state", "state": "processing"})

                parse_prompt = f"""You are a voice waiter bot for {restaurant_name}.
The customer just said something. Based on the FULL conversation so far, extract their order.

MENU:
{menu_list}

FULL CONVERSATION SO FAR:
{chr(10).join(f"{'Customer' if h['role']=='customer' else 'Bot'}: {h['text']}" for h in conversation_history)}

Respond in STRICT JSON only:
{{
  "items": [{{"name": "exact menu item name", "qty": number}}],
  "unavailable": ["items not on menu"],
  "response_text": "A short Hindi/Hinglish response confirming the order and asking customer to confirm. Be natural, conversational. Include item names and total price.",
  "needs_more_info": false
}}

RULES:
- Match item names EXACTLY to the menu.
- "ek"→1, "do"→2, "teen"→3, "char"→4, "paanch"→5
- If customer wants to add more or modify, set needs_more_info to true.
- If customer says something unrelated or unclear, politely ask what they want.
- response_text should be in Hinglish (Hindi+English mix) and sound natural like a real waiter.
- Always mention the total price in response_text."""

                llm_raw = await sarvam_llm(parse_prompt, f'Customer said: "{transcript}"')
                print(f"[VBOT] LLM raw: {llm_raw}")

                try:
                    cleaned = llm_raw.replace("```json", "").replace("```", "").strip()
                    data = json.loads(cleaned)

                    items = data.get("items", [])
                    unavailable = data.get("unavailable", [])
                    response_text = data.get("response_text", "")
                    needs_more = data.get("needs_more_info", False)

                    # Fuzzy match items to menu
                    from difflib import SequenceMatcher
                    menu_lookup = {m["name"]: m for m in menu_data}
                    menu_lower = {m["name"].lower(): m["name"] for m in menu_data}

                    matched_items = []
                    for item in items:
                        name = item.get("name", "")
                        qty = max(1, int(item.get("qty", 1)))

                        # Try exact match
                        if name in menu_lookup:
                            meta = menu_lookup[name]
                            matched_items.append({"name": name, "qty": qty, "menu_item_id": meta["id"], "price": meta["price"]})
                            continue

                        # Case-insensitive
                        if name.lower() in menu_lower:
                            exact = menu_lower[name.lower()]
                            meta = menu_lookup[exact]
                            matched_items.append({"name": exact, "qty": qty, "menu_item_id": meta["id"], "price": meta["price"]})
                            continue

                        # Fuzzy
                        best_score, best_match = 0, None
                        for mn in menu_lookup:
                            score = SequenceMatcher(None, name.lower(), mn.lower()).ratio()
                            if score > best_score:
                                best_score, best_match = score, mn
                        if best_score >= 0.55 and best_match:
                            meta = menu_lookup[best_match]
                            matched_items.append({"name": best_match, "qty": qty, "menu_item_id": meta["id"], "price": meta["price"]})
                        elif name:
                            unavailable.append(name)

                    parsed_items = matched_items
                    total = sum(i["price"] * i["qty"] for i in matched_items)

                    # Send order data to client
                    await ws.send_json({
                        "type": "order",
                        "items": matched_items,
                        "unavailable": unavailable,
                        "total": round(total, 2),
                    })

                    if needs_more or not matched_items:
                        # Bot asks for more info
                        if not response_text:
                            response_text = "Main samajh nahi paaya. Kya aap apna order dobara bata sakte hain?"
                        await bot_speak(response_text, "listening")
                    else:
                        # Build confirmation response if LLM didn't give one
                        if not response_text:
                            item_list = ", ".join(f"{i['qty']} {i['name']}" for i in matched_items)
                            response_text = f"Aapka order hai: {item_list}. Total {int(total)} rupees. Kya confirm karein?"

                        conversation_history.append({"role": "bot", "text": response_text})
                        await bot_speak(response_text, "confirming")

                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    print(f"[VBOT] Parse error: {e}")
                    await bot_speak("Sorry, main samajh nahi paaya. Kya aap apna order dobara bata sakte hain?", "listening")

            elif state == "confirming":
                # Check if customer confirmed or wants changes
                confirm_prompt = f"""The customer was asked to confirm their order. They said: "{transcript}"
                
Determine their intent. Respond with STRICT JSON only:
{{"confirmed": true/false, "wants_changes": false, "response_text": "short response"}}

- If customer says "haan", "yes", "confirm", "theek hai", "ok", "right", "sahi hai", "bilkul" → confirmed: true
- If customer says "nahi", "no", "cancel", "change", "modify", "add", "remove", "hatao" → confirmed: false, wants_changes: true
- response_text should be in Hinglish. If confirmed: "Bahut accha! Aapka order place ho gaya hai!" If not: "Koi baat nahi, bataiye kya change karna hai?"
"""
                confirm_raw = await sarvam_llm(confirm_prompt, f'Customer said: "{transcript}"')
                print(f"[VBOT] Confirm LLM: {confirm_raw}")

                try:
                    cleaned = confirm_raw.replace("```json", "").replace("```", "").strip()
                    result = json.loads(cleaned)
                    confirmed = result.get("confirmed", False)
                    wants_changes = result.get("wants_changes", False)
                    resp_text = result.get("response_text", "")

                    if confirmed and parsed_items:
                        # ── PLACE THE ORDER + KOTs ────────────────────────
                        await ws.send_json({"type": "state", "state": "confirmed"})

                        order_db = SessionLocal()
                        try:
                            from models import Order, OrderItem

                            subtotal = sum(i["price"] * i["qty"] for i in parsed_items)
                            gst = round(subtotal * 0.05, 2)
                            total_amount = round(subtotal + gst, 2)

                            new_order = Order(
                                restaurant_id=restaurant_id,
                                order_type="dine_in",
                                status="confirmed",
                                subtotal=subtotal,
                                tax_amount=gst,
                                total_amount=total_amount,
                                table_number=table_id,
                                notes=f"[Voice Bot Call] {full_transcript[:300]}",
                            )
                            order_db.add(new_order)
                            order_db.flush()

                            for item in parsed_items:
                                oi = OrderItem(
                                    order_id=new_order.id,
                                    menu_item_id=item["menu_item_id"],
                                    quantity=item["qty"],
                                    unit_price=item["price"],
                                )
                                order_db.add(oi)

                            order_db.commit()
                            order_db.refresh(new_order)
                            order_id = str(new_order.id)

                            # Auto-generate KOTs
                            try:
                                from services.order_service import OrderService
                                svc = OrderService(order_db)
                                svc.generate_kots(new_order.id)
                                order_db.commit()
                            except Exception as e:
                                print(f"[VBOT] KOT error: {e}")

                        finally:
                            order_db.close()

                        await ws.send_json({
                            "type": "confirmed",
                            "order_id": order_id,
                            "total": total_amount,
                            "message": "Order placed successfully!",
                        })

                        if not resp_text:
                            resp_text = f"Bahut accha! Aapka order place ho gaya hai. Total {int(total_amount)} rupees. Dhanyavaad!"
                        conversation_history.append({"role": "bot", "text": resp_text})
                        await bot_speak(resp_text, "done")
                        state = "done"

                    elif wants_changes:
                        if not resp_text:
                            resp_text = "Koi baat nahi, bataiye kya change karna hai?"
                        conversation_history.append({"role": "bot", "text": resp_text})
                        await bot_speak(resp_text, "listening")

                    else:
                        if not resp_text:
                            resp_text = "Kya confirm karna hai? Haan ya nahi bataiye."
                        await bot_speak(resp_text, "confirming")

                except (json.JSONDecodeError, ValueError) as e:
                    print(f"[VBOT] Confirm parse error: {e}")
                    await bot_speak("Kya confirm karna hai? Haan ya nahi bataiye.", "confirming")

            elif state == "done":
                # Customer said something after order was placed
                await bot_speak("Aapka order pehle se place ho chuka hai. Dhanyavaad! Bye!", "done")

    except WebSocketDisconnect:
        print(f"[VBOT] Client disconnected (table {table_id})")
    except Exception as e:
        print(f"[VBOT] Error: {e}")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except:
            pass
