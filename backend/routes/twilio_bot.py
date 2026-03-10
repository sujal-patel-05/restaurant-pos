"""
Twilio Phone Call Bot — "Eva" AI Hostess over Real Phone Calls.

Architecture:
  1. Customer dials Twilio phone number
  2. Twilio hits POST /api/twilio/incoming → Eva greets with TwiML
  3. <Gather input="speech"> captures voice → Twilio sends to /api/twilio/handle-speech
  4. Backend parses transcript with Sarvam LLM → responds with TwiML <Say>
  5. Flow: greeting → listening → confirming → asking_name → KOT → done
  6. Mirrors the digital call Eva bot with same personality, strict menu, name collection

Conversation state tracked per CallSid in memory (dict).

Endpoints:
  POST /api/twilio/incoming        — Incoming call webhook (Eva greets)
  POST /api/twilio/handle-speech   — Process speech + respond
  POST /api/twilio/status          — Call status callback (cleanup)
  GET  /api/twilio/setup           — Setup instructions
"""
import os
import re
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
# ═══════════════════════════════════════════════════════════════════════════════
call_sessions = {}
# Format: { "CA...sid": { "state": "listening|confirming|asking_name|done",
#                          "items": [...], "transcript": "...", "history": [...],
#                          "restaurant_id": "...", "suggestion_given": False } }


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def get_menu_and_restaurant(db: Session, restaurant_id: str = None):
    """Get restaurant menu data, formatted string, and name."""
    from models import MenuItem, Restaurant

    if not restaurant_id:
        restaurant = db.query(Restaurant).first()
        if restaurant:
            restaurant_id = str(restaurant.id)
        else:
            return "", [], "Restaurant", None

    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    restaurant_name = restaurant.name if restaurant else "Restaurant"

    items = (
        db.query(MenuItem)
        .filter(MenuItem.restaurant_id == restaurant_id, MenuItem.is_available == True)
        .all()
    )
    menu_data = [{"id": str(item.id), "name": item.name, "price": float(item.price)} for item in items]
    menu_str = "\n".join([f"- {m['name']} (₹{m['price']})" for m in menu_data])

    return menu_str, menu_data, restaurant_name, restaurant_id


def twiml_say(text: str, gather_action: str = None, language: str = "hi-IN",
              voice: str = "Polly.Aditi", gather_timeout: int = 5) -> Response:
    """
    Build TwiML response with <Say>. If gather_action provided, wraps in <Gather>.
    """
    # Final cleanup to remove any reasoning tags before speaking
    text = strip_think_tags(text)

    # Use phonetic spelling for name to avoid "E-V-A"
    import re
    vocal_text = re.sub(r'\bEva\b', 'Evaaa', text)

    # Escape XML special chars in text
    safe_text = vocal_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n'

    if gather_action:
        twiml += f'  <Gather input="speech" action="{gather_action}" '
        twiml += f'speechTimeout="{gather_timeout}" language="{language}" '
        twiml += f'actionOnEmptyResult="true">\n'
        twiml += f'    <Say voice="{voice}" language="{language}">{safe_text}</Say>\n'
        twiml += f'  </Gather>\n'
        # Fallback if silence
        twiml += f'  <Say voice="{voice}" language="{language}">Kya aap wahan hain? Please boliye.</Say>\n'
        twiml += f'  <Redirect>/api/twilio/incoming</Redirect>\n'
    else:
        twiml += f'  <Say voice="{voice}" language="{language}">{safe_text}</Say>\n'
        twiml += f'  <Hangup/>\n'

    twiml += '</Response>'
    return Response(content=twiml, media_type="application/xml")


def fuzzy_match_menu(name: str, menu_data: list) -> dict | None:
    """Fuzzy match an item name to the menu. Returns menu item dict or None."""
    from difflib import SequenceMatcher

    menu_lookup = {m["name"]: m for m in menu_data}
    menu_lower = {m["name"].lower(): m["name"] for m in menu_data}

    if name in menu_lookup:
        return menu_lookup[name]
    if name.lower() in menu_lower:
        return menu_lookup[menu_lower[name.lower()]]

    best_score, best_match = 0, None
    for mn in menu_lookup:
        score = SequenceMatcher(None, name.lower(), mn.lower()).ratio()
        if score > best_score:
            best_score, best_match = score, mn
    if best_score >= 0.55 and best_match:
        return menu_lookup[best_match]
    return None


def strip_think_tags(text: str) -> str:
    """Remove <think>...</think> reasoning tags from LLM responses."""
    import re
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    # Also handle partial or broken tags just in case
    cleaned = cleaned.replace("<think>", "").replace("</think>", "").strip()
    return cleaned


async def sarvam_llm(system_prompt: str, user_msg: str) -> str:
    """Call Sarvam LLM with Groq fallback. Returns raw text."""
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
                        "messages": [{"role": "system", "content": system_prompt},
                                      {"role": "user", "content": user_msg}],
                        "max_tokens": 600, "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    raw = resp.json()["choices"][0]["message"]["content"].strip()
                    print(f"[TWILIO-LLM] Sarvam: {raw[:120]}")
                    return raw
        except Exception as e:
            print(f"[TWILIO-LLM] Sarvam error: {e}")

    # Groq fallback
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": system_prompt},
                           {"role": "user", "content": user_msg}],
                max_tokens=600, temperature=0.1,
            )
            raw = response.choices[0].message.content.strip()
            print(f"[TWILIO-LLM] Groq: {raw[:120]}")
            return raw
        except Exception as e:
            print(f"[TWILIO-LLM] Groq error: {e}")

    return '{"action":"need_info","items":[],"response_text":"Sorry, kuch problem aa gayi. Dobara bataiye?","needs_more_info":true}'


def extract_json(raw: str) -> dict:
    """Robustly extract JSON from LLM output (handles <think> tags, markdown fences)."""
    cleaned = strip_think_tags(raw)
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)
    return json.loads(cleaned)


# ═══════════════════════════════════════════════════════════════════════════════
# Prompts — Same Eva personality as digital call
# ═══════════════════════════════════════════════════════════════════════════════

def build_order_prompt(restaurant_name: str, menu_str: str,
                       conversation_history: list, current_order: list) -> str:
    """Build system prompt for Eva — AI hostess on phone call."""

    history_text = "\n".join(
        f"{'Customer' if h['role'] == 'customer' else 'Eva'}: {h['text']}"
        for h in conversation_history
    )

    current_order_text = ""
    if current_order:
        current_order_text = "CURRENT ORDER SO FAR:\n" + "\n".join(
            f"  - {i['qty']}x {i['name']} (₹{i['price']})" for i in current_order
        )
        total = sum(i['price'] * i['qty'] for i in current_order)
        current_order_text += f"\n  SUBTOTAL: ₹{int(total)}"

    return f"""You are EVA, a warm, friendly, and experienced AI hostess/waiter at {restaurant_name}.
You are talking to a customer on a PHONE CALL. You take orders just like a REAL HUMAN waiter.

YOUR PERSONALITY:
- You are warm, cheerful, and professional — like a 5-star restaurant hostess
- You speak in natural Hinglish (Hindi + English mix), the way real Indians talk on phone
- You use natural filler words: "Ji", "Bilkul", "Zaroor", "Ekdum", "Accha"
- You are FAST and EFFICIENT — keep responses 1-3 sentences MAX
- You sound like a REAL PERSON, not a robot
- CRITICAL: You ONLY accept items from the MENU below. If customer asks for anything NOT on the menu, politely refuse and suggest alternatives from the menu.

MENU (ONLY these items can be ordered):
{menu_str}

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
1. Match item names EXACTLY to MENU. Handle variations: kaafi→Coffee, biriyani→Biryani, naan→Naan
2. STRICT MENU RULE: If customer asks for ANY item NOT on the MENU, put it in `unavailable` and tell them it is not available. Do NOT add it to `items`!
3. Hindi number words: ek→1, do→2, teen→3, char→4, paanch→5
4. Default quantity is 1 if not specified
5. If customer says "aur" or adds items, set action="modify_order" with ONLY the NEW items
6. If customer says "hatao"/"remove"/"cancel [item]", put those in remove_items
7. If customer says "bas itna" / "that's all" / "confirm" / "done", set ready_to_confirm=true
8. response_text MUST be in Hinglish, SHORT (max 2-3 sentences), and include total price
9. ALWAYS include total price when you have items
10. Only suggest ONCE, not repeatedly. Only suggest items FROM the menu"""


def build_confirm_prompt(restaurant_name: str) -> str:
    """Prompt for checking if customer confirmed their order."""
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
  "हाँ", "हां", "जी", "जी हाँ", "ठीक", "ठीक है", "कर दो", "बिल्कुल", "कन्फर्म",
  "confirm karo", "order laga do", "final hai"
- CHANGE words: "nahi", "no", "cancel", "change", "modify", "hatao", "galat", "wrong", "ruk",
  "नहीं", "कैंसल", "बदलो", "हटाओ", "गलत", "रुको"
- ADD words: "aur", "add", "ek aur", "ye bhi", "aur chahiye", "और", "और चाहिए"

Keep response SHORT — max 1-2 sentences in Hinglish."""


# ═══════════════════════════════════════════════════════════════════════════════
# POST /incoming — Twilio calls this when someone dials your number
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/incoming")
async def handle_incoming_call(request: Request, CallSid: str = Form(""), From: str = Form("")):
    """
    First webhook: customer dials, Twilio calls this.
    Eva greets and starts listening for the order.
    """
    print(f"[TWILIO] 📞 Incoming call from {From} (SID: {CallSid})")

    # Get restaurant info
    db = SessionLocal()
    try:
        menu_str, menu_data, restaurant_name, restaurant_id = get_menu_and_restaurant(db)
    finally:
        db.close()

    # Initialize session
    call_sessions[CallSid] = {
        "state": "listening",
        "items": [],
        "transcript": "",
        "history": [],
        "caller": From,
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant_name,
        "suggestion_given": False,
        "started_at": datetime.now().isoformat(),
    }

    greeting = (
        f"Namaste! {restaurant_name} mein aapka swagat hai! "
        f"Main Eva, aapki hostess hoon aaj ke liye. "
        f"Bataiye, kya order karna chahenge?"
    )

    call_sessions[CallSid]["history"].append({"role": "bot", "text": greeting})

    return twiml_say(
        text=greeting,
        gather_action="/api/twilio/handle-speech",
        gather_timeout=6,
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
        session = {
            "state": "listening", "items": [], "transcript": "",
            "history": [], "caller": "", "restaurant_id": None,
            "restaurant_name": "Restaurant", "suggestion_given": False,
        }
        call_sessions[CallSid] = session

    transcript = SpeechResult.strip()
    confidence = float(Confidence) if Confidence else 0

    print(f'[TWILIO] 🗣️ Speech [{session["state"]}]: "{transcript}" (conf: {confidence:.0%})')

    if not transcript:
        return twiml_say(
            text="Main sun nahi paayi. Kya aap dobara bol sakte hain?",
            gather_action="/api/twilio/handle-speech",
        )

    session["transcript"] += (" " + transcript) if session["transcript"] else transcript
    session["history"].append({"role": "customer", "text": transcript})

    # Get menu data
    db = SessionLocal()
    try:
        menu_str, menu_data, restaurant_name, restaurant_id = get_menu_and_restaurant(
            db, session.get("restaurant_id")
        )
        if restaurant_id:
            session["restaurant_id"] = restaurant_id
            session["restaurant_name"] = restaurant_name
    finally:
        db.close()

    # ── STATE: LISTENING — Parse the order ────────────────────────────────
    if session["state"] == "listening":
        system_prompt = build_order_prompt(
            restaurant_name, menu_str, session["history"], session["items"]
        )
        llm_raw = await sarvam_llm(system_prompt, f'Customer just said: "{transcript}"')
        print(f"[TWILIO] LLM raw: {llm_raw[:150]}")

        try:
            data = extract_json(llm_raw)

            action = data.get("action", "take_order")
            new_items = data.get("items", [])
            remove_items = data.get("remove_items", [])
            unavailable = data.get("unavailable", [])
            response_text = data.get("response_text", "")
            needs_more = data.get("needs_more_info", False)
            ready_to_confirm = data.get("ready_to_confirm", False)
            suggestion = data.get("suggestion", "")

            # Process new items via fuzzy match
            for item in new_items:
                name = item.get("name", "")
                qty = max(1, int(item.get("qty", 1)))

                match = fuzzy_match_menu(name, menu_data)
                if match:
                    existing = next((o for o in session["items"] if o["menu_item_id"] == match["id"]), None)
                    if existing and action == "modify_order":
                        existing["qty"] += qty
                    elif existing and action == "take_order":
                        existing["qty"] = qty
                    else:
                        session["items"].append({
                            "name": match["name"],
                            "qty": qty,
                            "menu_item_id": match["id"],
                            "price": match["price"],
                        })
                elif name:
                    unavailable.append(name)

            # Process removals
            for rm_name in remove_items:
                rm_lower = rm_name.lower()
                session["items"][:] = [
                    o for o in session["items"]
                    if o["name"].lower() != rm_lower
                ]

            # Decide response
            if ready_to_confirm and session["items"]:
                total = sum(i["price"] * i["qty"] for i in session["items"])
                item_list = ", ".join(f"{i['qty']} {i['name']}" for i in session["items"])

                if not response_text:
                    response_text = (
                        f"Ji bilkul! Aapka order hai: {item_list}. "
                        f"Total {int(total)} rupees. Confirm kar doon?"
                    )

                session["state"] = "confirming"
                session["history"].append({"role": "bot", "text": response_text})

                return twiml_say(
                    text=response_text,
                    gather_action="/api/twilio/handle-speech",
                    gather_timeout=5,
                )

            elif session["items"] and not needs_more:
                total = sum(i["price"] * i["qty"] for i in session["items"])
                item_list = ", ".join(f"{i['qty']} {i['name']}" for i in session["items"])

                suggestion_part = ""
                if suggestion and not session.get("suggestion_given"):
                    session["suggestion_given"] = True
                    suggestion_part = f" {suggestion} bhi try karenge?"

                if not response_text:
                    response_text = (
                        f"Ji zaroor! {item_list}, total {int(total)} rupees."
                        f"{suggestion_part} "
                        f"Aur kuch chahiye ya confirm karein?"
                    )

                if unavailable:
                    unavail_text = ", ".join(unavailable)
                    response_text = f"Maaf kijiye, {unavail_text} available nahi hai. " + response_text

                session["history"].append({"role": "bot", "text": response_text})

                return twiml_say(
                    text=response_text,
                    gather_action="/api/twilio/handle-speech",
                    gather_timeout=5,
                )

            else:
                if not response_text:
                    if unavailable:
                        unavail_text = ", ".join(unavailable)
                        response_text = f"Sorry ji, {unavail_text} available nahi hai. Aur kuch bataiye?"
                    else:
                        response_text = "Ji, main sun rahi hoon. Kya order karna chahenge?"

                session["history"].append({"role": "bot", "text": response_text})

                return twiml_say(
                    text=response_text,
                    gather_action="/api/twilio/handle-speech",
                    gather_timeout=5,
                )

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"[TWILIO] Parse error: {e}")
            return twiml_say(
                text="Sorry ji, main samajh nahi paayi. Ek baar phir bataiye kya chahiye?",
                gather_action="/api/twilio/handle-speech",
            )

    # ── STATE: CONFIRMING — Check yes/no ──────────────────────────────────
    elif session["state"] == "confirming":
        system_prompt = build_confirm_prompt(restaurant_name)
        confirm_raw = await sarvam_llm(system_prompt, f'Customer said: "{transcript}"')
        print(f"[TWILIO] Confirm LLM: {confirm_raw[:120]}")

        try:
            result = extract_json(confirm_raw)
            confirmed = result.get("confirmed", False)
            wants_changes = result.get("wants_changes", False)
            wants_to_add = result.get("wants_to_add", False)
            resp_text = result.get("response_text", "")

            if confirmed and session["items"]:
                # Ask for name before placing order
                name_ask = (
                    "Bahut badhiya ji! Order confirm ho raha hai. "
                    "Bas ek last cheez, aapka shubh naam bata dijiye?"
                )
                session["state"] = "asking_name"
                session["history"].append({"role": "bot", "text": name_ask})

                return twiml_say(
                    text=name_ask,
                    gather_action="/api/twilio/handle-speech",
                    gather_timeout=6,
                )

            elif wants_to_add:
                if not resp_text:
                    resp_text = "Zaroor ji! Bataiye aur kya add karein?"
                session["state"] = "listening"
                session["history"].append({"role": "bot", "text": resp_text})
                return twiml_say(text=resp_text, gather_action="/api/twilio/handle-speech")

            elif wants_changes:
                if not resp_text:
                    resp_text = "Koi baat nahi ji! Bataiye kya change karna hai?"
                session["state"] = "listening"
                session["items"] = []
                session["history"].append({"role": "bot", "text": resp_text})
                return twiml_say(text=resp_text, gather_action="/api/twilio/handle-speech")

            else:
                if not resp_text:
                    resp_text = "Ji, confirm karna hai? Haan ya nahi bataiye."
                return twiml_say(text=resp_text, gather_action="/api/twilio/handle-speech")

        except (json.JSONDecodeError, ValueError) as e:
            print(f"[TWILIO] Confirm parse error: {e}")
            return twiml_say(
                text="Confirm karna hai ji? Haan ya nahi bataiye.",
                gather_action="/api/twilio/handle-speech",
            )

    # ── STATE: ASKING_NAME — Extract customer name ────────────────────────
    elif session["state"] == "asking_name":
        # Use LLM to extract name
        name_prompt = (
            "You are a name extractor. The customer just told their name on a phone call. "
            "Extract ONLY the person's name from what they said. "
            "They might say 'mera naam Rahul hai' or 'Sujal' or 'I am Priya' etc. "
            "Respond with ONLY the name in plain text, nothing else. No JSON, no quotes. "
            "If you can't find a name, respond with 'Customer'."
        )
        customer_name = await sarvam_llm(name_prompt, f'Customer said: "{transcript}"')
        customer_name = strip_think_tags(customer_name).strip().strip('"').strip("'").strip()
        if not customer_name or len(customer_name) > 50:
            customer_name = "Customer"

        print(f"[TWILIO] 👤 Customer name: {customer_name}")
        session["state"] = "done"

        # ── PLACE THE ORDER + KOT ────────────────────────────────────────
        order_db = SessionLocal()
        try:
            from models import User, Restaurant
            from services.order_service import OrderService

            r_id = session.get("restaurant_id")
            if not r_id:
                restaurant = order_db.query(Restaurant).first()
                r_id = str(restaurant.id) if restaurant else None

            admin_user = order_db.query(User).filter(User.role == "admin").first()
            user_id = admin_user.id if admin_user else None

            order_payload = {
                "order_type": "delivery",
                "order_source": "phone_call",
                "items": [
                    {"menu_item_id": i["menu_item_id"], "quantity": i["qty"]}
                    for i in session["items"]
                ],
                "customer_phone": session.get("caller", ""),
                "customer_name": customer_name,
                "special_instructions": f"[Eva Phone Call] Customer: {customer_name} | {session['transcript'][:200]}"
            }

            result = OrderService.create_order(order_db, r_id, order_payload, user_id)

            if result.get("success"):
                total = result["total_amount"]
                order_id = result["order_id"]
                print(f"[TWILIO] ✅ Order placed! ID: {order_id}, Total: ₹{total}, Customer: {customer_name}")
            else:
                raise Exception(result.get("error", "Unknown error"))

        except Exception as e:
            print(f"[TWILIO] Order creation error: {e}")
            call_sessions.pop(CallSid, None)
            return twiml_say(
                text="Maafi chahti hoon, order place karte samay problem aa gayi. Phir se call kariye."
            )
        finally:
            order_db.close()

        # Build closing message with KOT confirmation and 20-min ETA
        item_list = ", ".join(f"{i['qty']} {i['name']}" for i in session["items"])
        closing = (
            f"Dhanyavaad {customer_name} ji! "
            f"Aapka order successfully place ho gaya hai. "
            f"Aapne order kiya hai: {item_list}. Total {int(total)} rupees. "
            f"KOT generate ho gaya hai kitchen mein. "
            f"Approximately 20 minutes mein aapka order ready hoga. "
            f"Dhanyavaad ji! Have a great day!"
        )

        call_sessions.pop(CallSid, None)
        return twiml_say(text=closing)  # No gather = call ends after speaking

    # ── STATE: DONE ───────────────────────────────────────────────────────
    else:
        call_sessions.pop(CallSid, None)
        return twiml_say(
            text="Aapka order pehle se place ho chuka hai ji. Dhanyavaad! Namaste!"
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
# GET /setup — How to configure Twilio
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
            "7. Call your Twilio number and talk to Eva!",
        ],
        "current_config": {
            "account_sid": settings.TWILIO_ACCOUNT_SID[:10] + "..." if settings.TWILIO_ACCOUNT_SID else "Not set",
            "phone_number": settings.TWILIO_PHONE_NUMBER or "Not set — buy one at console.twilio.com",
        }
    }
