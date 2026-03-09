"""
Twilio Phone Call Bot — Real phone-based AI order-taker.

Architecture:
  1. Customer dials Twilio phone number
  2. Twilio hits POST /api/twilio/incoming → bot greets with TwiML
  3. <Gather input="speech"> captures customer's voice → Twilio sends to /api/twilio/handle-speech
  4. Backend parses transcript with Sarvam LLM → responds with TwiML
  5. On "confirm" → Order + KOTs auto-generated → bot says "Dhanyavaad!"

Conversation state is tracked per CallSid in memory (dict).

Endpoints:
  POST /api/twilio/incoming        — Incoming call webhook (greets customer)
  POST /api/twilio/handle-speech   — Process speech + respond
  POST /api/twilio/status          — Call status callback (cleanup)
"""
import os
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Request, Form, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/twilio", tags=["Twilio Phone Bot"])

# ═══════════════════════════════════════════════════════════════════════════════
# In-memory conversation state (per call SID)
# In production, use Redis. For this project, dict is fine.
# ═══════════════════════════════════════════════════════════════════════════════
call_sessions = {}
# Format: { "CA...sid": { "state": "greeting|listening|confirming|done",
#                          "items": [...], "transcript": "...", "restaurant_id": "..." } }


def get_menu_list(db: Session, restaurant_id: str = None) -> tuple:
    """Get restaurant menu as formatted string and data list."""
    from models import MenuItem, Restaurant

    if not restaurant_id:
        restaurant = db.query(Restaurant).first()
        if restaurant:
            restaurant_id = str(restaurant.id)
        else:
            return "", [], "Restaurant"

    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    restaurant_name = restaurant.name if restaurant else "Restaurant"

    items = (
        db.query(MenuItem)
        .filter(MenuItem.restaurant_id == restaurant_id, MenuItem.is_available == True)
        .all()
    )
    menu_data = [{"id": str(item.id), "name": item.name, "price": float(item.price)} for item in items]
    menu_str = "\n".join([f"- {m['name']} (Rs.{m['price']})" for m in menu_data])

    return menu_str, menu_data, restaurant_name


def twiml_response(text: str, gather_action: str = None, language: str = "hi-IN",
                    voice: str = "Polly.Aditi", gather_timeout: int = 4) -> Response:
    """
    Build TwiML response.
    If gather_action is provided, wraps <Say> in <Gather> to capture next speech.
    """
    twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n'

    if gather_action:
        twiml += f'  <Gather input="speech" action="{gather_action}" '
        twiml += f'speechTimeout="{gather_timeout}" language="{language}" '
        twiml += f'actionOnEmptyResult="true">\n'
        twiml += f'    <Say voice="{voice}" language="{language}">{text}</Say>\n'
        twiml += f'  </Gather>\n'
        # Fallback if no speech detected
        twiml += f'  <Say voice="{voice}" language="{language}">Kya aap wahan hain? Please apna order bataiye.</Say>\n'
        twiml += f'  <Redirect>{gather_action.replace("/handle-speech", "/incoming")}</Redirect>\n'
    else:
        twiml += f'  <Say voice="{voice}" language="{language}">{text}</Say>\n'

    twiml += '</Response>'
    return Response(content=twiml, media_type="application/xml")


async def parse_order_with_llm(transcript: str, menu_str: str, menu_data: list,
                                restaurant_name: str, conversation_history: list = None) -> dict:
    """Use Sarvam/Groq LLM to parse order from transcript."""
    import httpx

    history_text = ""
    if conversation_history:
        history_text = "\n".join([f"{'Customer' if h['role']=='customer' else 'Bot'}: {h['text']}"
                                   for h in conversation_history])

    system_prompt = f"""You are an AI waiter taking phone orders for {restaurant_name}.
Parse the customer's speech into order items.

MENU:
{menu_str}

{f'CONVERSATION SO FAR:{chr(10)}{history_text}' if history_text else ''}

RESPOND IN STRICT JSON ONLY:
{{
  "items": [{{"name": "exact menu item name", "qty": number}}],
  "unavailable": ["items not on menu"],
  "response_hindi": "Short Hindi/Hinglish confirmation. Include items and total. Ask to confirm. Be natural like a real waiter.",
  "needs_more_info": false
}}

RULES:
- Match names EXACTLY to menu. Handle variations: kaafi→Coffee, biriyani→Biryani, roti/chapati→Roti
- Quantities: ek→1, do→2, teen→3, char→4, paanch→5, one→1, two→2, three→3
- Default qty = 1. Sum duplicates.
- If unclear, set needs_more_info=true and ask politely in response_hindi.
- response_hindi MUST be in Hindi/Hinglish and sound natural (like talking on phone).
- Always include total price in response_hindi."""

    user_msg = f'Customer said: "{transcript}"'

    # Sarvam LLM
    sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
    if sarvam_key:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://api.sarvam.ai/v1/chat/completions",
                    headers={"api-subscription-key": sarvam_key, "Content-Type": "application/json"},
                    json={
                        "model": "sarvam-m",
                        "messages": [{"role": "system", "content": system_prompt},
                                      {"role": "user", "content": user_msg}],
                        "max_tokens": 600, "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    raw = resp.json()["choices"][0]["message"]["content"].strip()
                    print(f"[TWILIO-LLM] Sarvam: {raw}")
                    cleaned = raw.replace("```json", "").replace("```", "").strip()
                    return json.loads(cleaned)
        except Exception as e:
            print(f"[TWILIO-LLM] Sarvam error: {e}")

    # Groq fallback
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "system", "content": system_prompt},
                           {"role": "user", "content": user_msg}],
                max_tokens=600, temperature=0.1,
            )
            raw = response.choices[0].message.content.strip()
            print(f"[TWILIO-LLM] Groq: {raw}")
            cleaned = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned)
        except Exception as e:
            print(f"[TWILIO-LLM] Groq error: {e}")

    return {"items": [], "unavailable": [], "response_hindi": "Sorry, kuch problem ho gaya. Kya aap dobara bata sakte hain?", "needs_more_info": True}


def fuzzy_match_items(items: list, menu_data: list) -> tuple:
    """Fuzzy match parsed items to actual menu items. Returns (matched, unavailable)."""
    from difflib import SequenceMatcher

    menu_lookup = {m["name"]: m for m in menu_data}
    menu_lower = {m["name"].lower(): m["name"] for m in menu_data}

    matched = []
    unavailable = []

    for item in items:
        name = item.get("name", "")
        qty = max(1, int(item.get("qty", 1)))

        # Exact match
        if name in menu_lookup:
            meta = menu_lookup[name]
            matched.append({"name": name, "qty": qty, "menu_item_id": meta["id"], "price": meta["price"]})
            continue

        # Case-insensitive
        if name.lower() in menu_lower:
            exact = menu_lower[name.lower()]
            meta = menu_lookup[exact]
            matched.append({"name": exact, "qty": qty, "menu_item_id": meta["id"], "price": meta["price"]})
            continue

        # Fuzzy
        best_score, best_match = 0, None
        for mn in menu_lookup:
            score = SequenceMatcher(None, name.lower(), mn.lower()).ratio()
            if score > best_score:
                best_score, best_match = score, mn
        if best_score >= 0.55 and best_match:
            meta = menu_lookup[best_match]
            matched.append({"name": best_match, "qty": qty, "menu_item_id": meta["id"], "price": meta["price"]})
        elif name:
            unavailable.append(name)

    return matched, unavailable


# ═══════════════════════════════════════════════════════════════════════════════
# POST /incoming — Twilio calls this when someone dials your number
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/incoming")
async def handle_incoming_call(request: Request, CallSid: str = Form(""), From: str = Form("")):
    """
    First webhook: customer dials, Twilio calls this.
    Bot greets and starts listening for the order.
    """
    print(f"[TWILIO] 📞 Incoming call from {From} (SID: {CallSid})")

    # Initialize session
    call_sessions[CallSid] = {
        "state": "listening",
        "items": [],
        "transcript": "",
        "history": [],
        "caller": From,
        "started_at": datetime.now().isoformat(),
    }

    greeting = (
        "Namaste! Restaurant mein aapka swagat hai. "
        "Aap kya order karna chahenge? "
        "Please apna poora order bataiye."
    )

    call_sessions[CallSid]["history"].append({"role": "bot", "text": greeting})

    return twiml_response(
        text=greeting,
        gather_action="/api/twilio/handle-speech",
        gather_timeout=5,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /handle-speech — Twilio sends customer's speech here
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/handle-speech")
async def handle_speech(
    request: Request,
    CallSid: str = Form(""),
    SpeechResult: str = Form(""),
    Confidence: str = Form("0"),
):
    """
    Called when customer finishes speaking.
    Twilio provides SpeechResult (transcription) and Confidence.
    """
    session = call_sessions.get(CallSid)
    if not session:
        # New session (shouldn't happen, but handle gracefully)
        session = {"state": "listening", "items": [], "transcript": "", "history": [], "caller": ""}
        call_sessions[CallSid] = session

    transcript = SpeechResult.strip()
    confidence = float(Confidence) if Confidence else 0

    print(f"[TWILIO] 🗣️ Speech [{session['state']}]: \"{transcript}\" (conf: {confidence:.0%})")

    if not transcript:
        return twiml_response(
            text="Main sun nahi paaya. Kya aap dobara bol sakte hain?",
            gather_action="/api/twilio/handle-speech",
        )

    session["transcript"] += (" " + transcript) if session["transcript"] else transcript
    session["history"].append({"role": "customer", "text": transcript})

    # ── STATE: LISTENING — Parse the order ────────────────────────────────
    if session["state"] == "listening":
        db = SessionLocal()
        try:
            menu_str, menu_data, restaurant_name = get_menu_list(db)
        finally:
            db.close()

        result = await parse_order_with_llm(
            transcript=session["transcript"],
            menu_str=menu_str,
            menu_data=menu_data,
            restaurant_name=restaurant_name,
            conversation_history=session["history"],
        )

        items_raw = result.get("items", [])
        unavailable = result.get("unavailable", [])
        response_text = result.get("response_hindi", "")
        needs_more = result.get("needs_more_info", False)

        matched, unmatched = fuzzy_match_items(items_raw, menu_data)
        unavailable.extend(unmatched)

        if matched and not needs_more:
            # Got valid items — confirm
            session["items"] = matched
            session["state"] = "confirming"

            total = sum(i["price"] * i["qty"] for i in matched)
            item_list = ", ".join(f"{i['qty']} {i['name']}" for i in matched)

            if not response_text:
                response_text = f"Aapka order hai: {item_list}. Total {int(total)} rupees. Kya yeh confirm hai? Haan ya nahi bataiye."

            if unavailable:
                unavail_text = ", ".join(unavailable)
                response_text = f"{unavail_text} available nahi hai. "  + response_text

            session["history"].append({"role": "bot", "text": response_text})

            return twiml_response(
                text=response_text,
                gather_action="/api/twilio/handle-speech",
                gather_timeout=5,
            )
        else:
            # Need more info
            if not response_text:
                response_text = "Main samajh nahi paaya. Kya aap apna order dobara bata sakte hain?"

            session["history"].append({"role": "bot", "text": response_text})

            return twiml_response(
                text=response_text,
                gather_action="/api/twilio/handle-speech",
                gather_timeout=5,
            )

    # ── STATE: CONFIRMING — Check yes/no ──────────────────────────────────
    elif session["state"] == "confirming":
        lower = transcript.lower().strip()

        # Detect confirmation
        yes_words = ["haan", "ha", "yes", "confirm", "ok", "okay", "theek", "sahi", "bilkul",
                      "right", "sure", "done", "place", "kar do", "de do", "lagao", "laga do"]
        no_words = ["nahi", "no", "cancel", "change", "modify", "add", "remove", "hatao",
                      "galat", "wrong", "nah", "mat", "ruk"]

        is_yes = any(w in lower for w in yes_words)
        is_no = any(w in lower for w in no_words)

        if is_yes and not is_no and session["items"]:
            # ── PLACE THE ORDER ───────────────────────────────────────
            session["state"] = "done"

            db = SessionLocal()
            try:
                from models import Order, OrderItem, Restaurant

                restaurant = db.query(Restaurant).first()
                restaurant_id = str(restaurant.id) if restaurant else None
                gst_pct = float(restaurant.gst_percentage) if restaurant and restaurant.gst_percentage else 5.0

                subtotal = sum(i["price"] * i["qty"] for i in session["items"])
                gst = round(subtotal * gst_pct / 100, 2)
                total = round(subtotal + gst, 2)

                new_order = Order(
                    restaurant_id=restaurant_id,
                    order_type="delivery",
                    status="confirmed",
                    subtotal=subtotal,
                    tax_amount=gst,
                    total_amount=total,
                    customer_phone=session.get("caller", ""),
                    notes=f"[Phone Call Bot] {session['transcript'][:300]}",
                )
                db.add(new_order)
                db.flush()

                for item in session["items"]:
                    oi = OrderItem(
                        order_id=new_order.id,
                        menu_item_id=item["menu_item_id"],
                        quantity=item["qty"],
                        unit_price=item["price"],
                    )
                    db.add(oi)

                db.commit()
                db.refresh(new_order)

                # Auto-generate KOTs
                try:
                    from services.order_service import OrderService
                    svc = OrderService(db)
                    svc.generate_kots(new_order.id)
                    db.commit()
                except Exception as e:
                    print(f"[TWILIO] KOT generation error: {e}")

                print(f"[TWILIO] ✅ Order placed! ID: {new_order.id}, Total: ₹{total}")

            finally:
                db.close()

            success_text = (
                f"Bahut accha! Aapka order place ho gaya hai. "
                f"Total {int(total)} rupees hai. "
                f"Aapki kitchen mein order bhej diya gaya hai. "
                f"Dhanyavaad! Namaste!"
            )

            # Cleanup session
            call_sessions.pop(CallSid, None)

            return twiml_response(text=success_text)  # No gather = call ends

        elif is_no:
            # Customer wants to change
            session["state"] = "listening"
            session["items"] = []

            change_text = "Koi baat nahi! Bataiye kya change karna hai? Aap naya order bata sakte hain."
            session["history"].append({"role": "bot", "text": change_text})

            return twiml_response(
                text=change_text,
                gather_action="/api/twilio/handle-speech",
                gather_timeout=5,
            )

        else:
            # Unclear — ask again
            return twiml_response(
                text="Kya aapka order confirm hai? Please haan ya nahi bataiye.",
                gather_action="/api/twilio/handle-speech",
                gather_timeout=5,
            )

    # ── STATE: DONE ─────────────────────────────────────────────────────
    else:
        call_sessions.pop(CallSid, None)
        return twiml_response(
            text="Aapka order pehle se place ho chuka hai. Dhanyavaad! Namaste!"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /status — Twilio status callback (cleanup)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/status")
async def call_status(CallSid: str = Form(""), CallStatus: str = Form("")):
    """Cleanup session when call ends."""
    print(f"[TWILIO] Call {CallSid} status: {CallStatus}")
    if CallStatus in ("completed", "failed", "busy", "no-answer", "canceled"):
        call_sessions.pop(CallSid, None)
    return Response(content="OK", media_type="text/plain")


# ═══════════════════════════════════════════════════════════════════════════════
# GET /setup-instructions — How to configure Twilio
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/setup")
async def setup_instructions():
    """Returns setup instructions for configuring Twilio."""
    return {
        "instructions": [
            "1. Go to https://console.twilio.com",
            "2. Buy a phone number (or use trial number)",
            "3. Under the phone number settings, set Voice webhook URL to:",
            "   POST https://YOUR_NGROK_URL/api/twilio/incoming",
            "4. Set Status callback URL to:",
            "   POST https://YOUR_NGROK_URL/api/twilio/status",
            "5. Run ngrok to expose your local server:",
            "   ngrok http 8000",
            "6. Copy the ngrok URL and update Twilio webhook",
        ],
        "current_config": {
            "account_sid": settings.TWILIO_ACCOUNT_SID[:10] + "..." if settings.TWILIO_ACCOUNT_SID else "Not set",
            "phone_number": settings.TWILIO_PHONE_NUMBER or "Not set — buy one at console.twilio.com",
        }
    }
