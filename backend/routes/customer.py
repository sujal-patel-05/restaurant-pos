"""
Customer-facing API routes for voice table ordering.
All routes use customer JWT auth (separate from staff auth).
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import get_db
from datetime import datetime, timedelta
from typing import Optional
import json
import uuid
import os
import tempfile
import time
import logging

from models import (
    MenuItem, MenuCategory, Order, OrderItem, KOT, OrderStatus, OrderType, OrderSource, Restaurant
)
from models.table_session import TableConfig, TableSession, VoiceOrderLog, SessionStatus
from services.order_service import OrderService
from utils.auth import create_access_token, decode_access_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/customer", tags=["Customer Voice Ordering"])


# ── Customer JWT Auth Dependency ──────────────────────────────────────────

def get_current_customer_session(
    db: Session = Depends(get_db),
    token: str = None,
):
    """Verify customer JWT and return active TableSession."""
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    from fastapi import Security

    # This is overridden below using the proper Security dependency
    pass


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Security

customer_bearer = HTTPBearer(auto_error=False)


def get_customer_session(
    credentials: HTTPAuthorizationCredentials = Security(customer_bearer),
    db: Session = Depends(get_db),
):
    """Verify customer JWT, check role=customer, return active TableSession."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("role") != "customer":
        raise HTTPException(status_code=403, detail="This endpoint is for customers only")

    session_id = payload.get("session_id")
    table_id = payload.get("table_id")

    if not session_id:
        raise HTTPException(status_code=401, detail="Invalid customer token")

    session = db.query(TableSession).filter(TableSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != SessionStatus.ACTIVE.value:
        raise HTTPException(status_code=403, detail="Session is no longer active. Please ask staff for help.")

    return session


# ── Rate Limiting (simple in-memory) ─────────────────────────────────────

_rate_limit_cache = {}  # session_id -> last_request_time


def check_rate_limit(session_id: str, limit_seconds: int = 10):
    """Simple rate limiter: 1 request per limit_seconds per session."""
    now = time.time()
    last = _rate_limit_cache.get(session_id, 0)
    if now - last < limit_seconds:
        remaining = int(limit_seconds - (now - last))
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {remaining} seconds before sending another voice order."
        )
    _rate_limit_cache[session_id] = now


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/session/start")
def start_session(
    table_id: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Start or resume a customer session for a table.
    No login needed — just table_id from device config.
    """
    # Find table config
    table_config = db.query(TableConfig).filter(
        TableConfig.table_id == table_id,
        TableConfig.is_active == True,
    ).first()

    if not table_config:
        raise HTTPException(status_code=404, detail=f"Table {table_id} not found or inactive")

    # Check for existing active session
    existing = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.status == SessionStatus.ACTIVE.value,
    ).first()

    if existing:
        # Check if the existing token is still valid
        payload = decode_access_token(existing.session_token)
        if not payload:
            logger.info(f"Resumed session {existing.id} had expired token, generating new one.")
            now = datetime.utcnow()
            new_token = create_access_token(
                data={
                    "role": "customer",
                    "session_id": existing.id,
                    "table_id": existing.table_id,
                    "table_number": existing.table_number,
                },
                expires_delta=timedelta(hours=8),
            )
            existing.session_token = new_token
            db.commit()

        return {
            "session_id": existing.id,
            "table_id": existing.table_id,
            "table_number": existing.table_number,
            "token": existing.session_token,
            "resumed": True,
        }

    # Create new session
    now = datetime.utcnow()
    session_id = f"SESSION-{table_id}-{now.strftime('%Y%m%d-%H%M%S')}-{now.microsecond // 1000:03d}"

    # Generate customer JWT
    token = create_access_token(
        data={
            "role": "customer",
            "session_id": session_id,
            "table_id": table_id,
            "table_number": table_config.table_number,
        },
        expires_delta=timedelta(hours=8),  # Long-lived for table device
    )

    session = TableSession(
        id=session_id,
        restaurant_id=table_config.restaurant_id,
        table_config_id=table_config.id,
        table_id=table_id,
        table_number=table_config.table_number,
        session_token=token,
        status=SessionStatus.ACTIVE.value,
        session_start=now,
    )
    db.add(session)
    db.commit()

    return {
        "session_id": session_id,
        "table_id": table_id,
        "table_number": table_config.table_number,
        "table_name": table_config.table_name,
        "token": token,
        "resumed": False,
    }


@router.post("/voice-order")
async def voice_order(
    audio: UploadFile = File(...),
    session: TableSession = Depends(get_customer_session),
    db: Session = Depends(get_db),
):
    """
    Process voice order: Whisper transcription -> Groq parsing -> fuzzy matching.
    Does NOT create an order — returns parsed result for customer confirmation.
    """
    check_rate_limit(session.id, limit_seconds=3)  # Reduced for faster retries

    # Save audio to temp file
    suffix = ".webm"
    if audio.filename and "." in audio.filename:
        suffix = "." + audio.filename.rsplit(".", 1)[1]

    tmp_path = None
    try:
        content = await audio.read()
        print(f"[VOICE-ROUTE] Received audio: {len(content)} bytes, filename='{audio.filename}', content_type='{audio.content_type}', suffix='{suffix}'")
        
        if len(content) < 500:
            return {"error": "Recording too short or empty. Please speak for at least 2 seconds.", "items": []}

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir="temp_audio") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
            print(f"[VOICE-ROUTE] Saved to: {tmp_path} ({os.path.getsize(tmp_path)} bytes)")

        # Process through the voice pipeline
        from services.voice_order_service import VoiceOrderService

        result = VoiceOrderService.process_voice_order(
            db=db,
            audio_path=tmp_path,
            session_id=session.id,
            table_id=session.table_id,
            restaurant_id=session.restaurant_id,
        )

        return result

    finally:
        # Clean up temp audio file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@router.post("/confirm-order")
def confirm_order(
    log_id: str = Form(...),
    final_items: str = Form(...),  # JSON string of final items
    was_edited: bool = Form(False),
    session: TableSession = Depends(get_customer_session),
    db: Session = Depends(get_db),
):
    """
    Confirm and place the voice order.
    Creates Order + OrderItems + KOTs -> pushes to kitchen.
    """
    # Parse final items
    try:
        items = json.loads(final_items)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid items data")

    if not items:
        raise HTTPException(status_code=400, detail="No items to order")

    # Validate the voice log belongs to this session
    voice_log = db.query(VoiceOrderLog).filter(
        VoiceOrderLog.id == log_id,
        VoiceOrderLog.session_id == session.id,
    ).first()

    if not voice_log:
        raise HTTPException(status_code=404, detail="Voice order log not found")

    if voice_log.was_confirmed:
        raise HTTPException(status_code=400, detail="This order was already confirmed")

    # Get restaurant for GST
    restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
    gst_pct = float(restaurant.gst_percentage) if restaurant else 5.0

    # Calculate totals
    subtotal = 0
    order_items_data = []
    for item in items:
        qty = max(1, int(item.get("qty", 1)))
        price = float(item.get("price", 0))
        line_total = round(price * qty, 2)
        subtotal += line_total
        order_items_data.append({
            "menu_item_id": item["menu_item_id"],
            "quantity": qty,
            "unit_price": price,
            "special_instructions": item.get("special_instruction"),
        })

    gst_amount = round(subtotal * gst_pct / 100, 2)
    total_amount = round(subtotal + gst_amount, 2)

    # Generate order number
    from datetime import datetime as dt
    now = dt.utcnow()
    order_number = f"ORD-{now.strftime('%d%H%M%S')}-{session.table_id}"

    # Create Order
    order = Order(
        id=str(uuid.uuid4()),
        restaurant_id=session.restaurant_id,
        order_number=order_number,
        order_type=OrderType.DINE_IN,
        order_source=OrderSource.VOICE_TABLE,
        status=OrderStatus.PLACED,
        table_number=session.table_number,
        session_id=session.id,
        voice_log_id=voice_log.id,
        subtotal=subtotal,
        gst_amount=gst_amount,
        total_amount=total_amount,
    )
    db.add(order)

    # Create OrderItems and KOTs
    kot_count = 0
    for item_data in order_items_data:
        order_item = OrderItem(
            id=str(uuid.uuid4()),
            order_id=order.id,
            menu_item_id=item_data["menu_item_id"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            special_instructions=item_data.get("special_instructions"),
        )
        db.add(order_item)
        db.flush()  # Get the ID

        # Create KOT
        kot_count += 1
        kot = KOT(
            id=str(uuid.uuid4()),
            order_id=order.id,
            order_item_id=order_item.id,
            kot_number=f"KOT-{order_number}-{kot_count}",
            status=OrderStatus.PLACED,
        )
        db.add(kot)

    # Update voice log
    voice_log.was_confirmed = True
    voice_log.was_edited = was_edited
    voice_log.order_id = order.id

    # Update session totals
    session.total_orders = (session.total_orders or 0) + 1
    session.total_spent = float(session.total_spent or 0) + total_amount

    # Try to deduct inventory via BOM
    try:
        from services.inventory_service import InventoryService
        for item_data in order_items_data:
            InventoryService.deduct_ingredients_for_menu_item(
                db, item_data["menu_item_id"], item_data["quantity"]
            )
    except Exception as e:
        logger.warning(f"[VOICE] Inventory deduction failed (non-blocking): {e}")

    db.commit()

    # Estimate wait time based on active KOTs
    active_kots = db.query(KOT).filter(
        KOT.status.in_([OrderStatus.PLACED.value, OrderStatus.PREPARING.value])
    ).count()
    estimated_wait = max(10, active_kots * 5)  # ~5 min per KOT, minimum 10

    return {
        "success": True,
        "order_id": order.id,
        "order_number": order_number,
        "total": total_amount,
        "items_count": len(order_items_data),
        "estimated_wait_minutes": estimated_wait,
        "message": "Order placed successfully! Your kitchen has been notified.",
    }


@router.get("/menu")
def get_customer_menu(
    session: TableSession = Depends(get_customer_session),
    db: Session = Depends(get_db),
):
    """Get available menu items grouped by category."""
    categories = (
        db.query(MenuCategory)
        .filter(MenuCategory.restaurant_id == session.restaurant_id, MenuCategory.is_active == True)
        .order_by(MenuCategory.display_order)
        .all()
    )

    result = []
    for cat in categories:
        items = [
            {
                "id": item.id,
                "name": item.name,
                "price": float(item.price),
                "description": item.description,
                "image_url": item.image_url,
                "preparation_time": item.preparation_time,
            }
            for item in cat.menu_items
            if item.is_available
        ]
        if items:
            result.append({
                "category": cat.name,
                "items": items,
            })

    return {"menu": result, "table": session.table_number}


@router.get("/orders")
def get_customer_orders(
    session: TableSession = Depends(get_customer_session),
    db: Session = Depends(get_db),
):
    """Get all orders for current session with their statuses."""
    orders = (
        db.query(Order)
        .filter(Order.session_id == session.id)
        .order_by(Order.created_at.desc())
        .all()
    )

    result = []
    for order in orders:
        items = []
        for oi in order.order_items:
            menu_item = oi.menu_item
            items.append({
                "name": menu_item.name if menu_item else "Unknown",
                "quantity": oi.quantity,
                "price": float(oi.unit_price),
                "status": oi.item_status.value if oi.item_status else "placed",
                "special_instructions": oi.special_instructions,
            })

        result.append({
            "order_id": order.id,
            "order_number": order.order_number,
            "status": order.status.value,
            "total": float(order.total_amount),
            "items": items,
            "created_at": order.created_at.isoformat() + "Z" if order.created_at else None,
        })

    return {
        "orders": result,
        "session_total": float(session.total_spent or 0),
        "total_orders": session.total_orders or 0,
    }


# ── Sarvam AI STT Proxy (Live Voice Ordering) ─────────────────────────────

@router.post("/transcribe")
async def transcribe_voice(
    audio: UploadFile = File(...),
    session: TableSession = Depends(get_customer_session),
    db: Session = Depends(get_db),
):
    """
    Proxy audio blob to Sarvam AI STT (primary) or Groq Whisper (fallback).
    API key stays on server — browser never sees it.
    Returns: { text, words, duration, language }
    """
    import httpx
    from config import settings
    import os
    import subprocess
    import tempfile

    content = await audio.read()
    if len(content) < 500:
        return {"text": "", "words": [], "duration": 0, "language": "en"}

    # Ensure temp directory exists (absolute path)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    temp_dir = os.path.join(base_dir, "temp_audio")
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)

    extension = ".webm"
    if audio.filename and "." in audio.filename:
        extension = "." + audio.filename.rsplit(".", 1)[1].lower()

    tmp_path = None
    wav_path = None
    try:
        import time
        ts = int(time.time() * 1000)
        tmp_filename = f"voice_{ts}{extension}"
        tmp_path = os.path.join(temp_dir, tmp_filename)
        
        with open(tmp_path, "wb") as f:
            f.write(content)
        
        debug_msg = f"[TRANSCRIBE] Saved raw audio (len={len(content)}) to: {tmp_path}"
        print(debug_msg)
        logger.info(debug_msg)

        # Write to a persistent log file
        log_path = os.path.join(temp_dir, "transcribe_debug.log")
        with open(log_path, "a", encoding="utf-8") as log_f:
            log_f.write(f"\n--- {datetime.utcnow().isoformat()} ---\n")
            log_f.write(debug_msg + "\n")

            # Convert to WAV 16kHz mono for Sarvam AI
            wav_path = os.path.join(temp_dir, f"voice_{ts}_converted.wav")
            
            # Robust ffmpeg call (handling spaces and Windows quirks)
            ffmpeg_cmd = f'ffmpeg -y -i "{tmp_path}" -ar 16000 -ac 1 -c:a pcm_s16le -f wav "{wav_path}"'
            log_f.write(f"Running ffmpeg: {ffmpeg_cmd}\n")
            
            kwargs = {}
            if os.name == 'nt':
                kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
            
            process = subprocess.run(ffmpeg_cmd, shell=True, capture_output=True, text=True, timeout=15, **kwargs)
            
            if process.returncode != 0:
                err_msg = f"[TRANSCRIBE] ❌ ffmpeg failed: {process.stderr}"
                print(err_msg)
                log_f.write(err_msg + "\n")
                use_wav = False
            else:
                success_msg = f"[TRANSCRIBE] ✅ ffmpeg success: {wav_path} ({os.path.getsize(wav_path)} bytes)"
                print(success_msg)
                log_f.write(success_msg + "\n")
                use_wav = True

            # ── Primary: Sarvam AI STT ──────────────────────────────────────
            sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
            if sarvam_key:
                try:
                    target_file = wav_path if use_wav else tmp_path
                    if os.path.exists(target_file) and os.path.getsize(target_file) > 1000:
                        file_size = os.path.getsize(target_file)
                        log_f.write(f"Sending {target_file} ({file_size} bytes) to Sarvam AI\n")
                        
                        with open(target_file, "rb") as audio_file:
                            payload = {
                                "model": "saaras:v3",
                                "language_code": "hi-IN",
                                "mode": "transcribe",
                            }
                            resp = httpx.post(
                                "https://api.sarvam.ai/speech-to-text",
                                headers={"api-subscription-key": sarvam_key},
                                data=payload,
                                files={"file": ("audio.wav", audio_file, "audio/wav")},
                                timeout=30.0,
                            )

                        log_f.write(f"Sarvam Status: {resp.status_code}\n")
                        log_f.write(f"Sarvam Response: {resp.text[:500]}\n")
                        
                        if resp.status_code == 200:
                            data = resp.json()
                            transcript = data.get("transcript", "").strip()
                            lang = data.get("language_code", "hi-IN")
                            resp_msg = f"[TRANSCRIBE-SARVAM] ✅ transcript='{transcript}' lang={lang}"
                            print(resp_msg)
                            log_f.write(resp_msg + "\n")
                            
                            if transcript:
                                return {
                                    "text": transcript,
                                    "words": [],
                                    "duration": None,
                                    "language": lang,
                                }
                            else:
                                log_f.write("Sarvam returned empty transcript, trying Groq fallback\n")
                        else:
                            err_resp = f"[TRANSCRIBE-SARVAM] ❌ API Error {resp.status_code}: {resp.text}"
                            print(err_resp)
                            log_f.write(err_resp + "\n")
                    else:
                        log_f.write(f"Target file too small or missing: {target_file}\n")
                except Exception as e:
                    log_f.write(f"Sarvam API Exception: {str(e)}\n")

            # ── Fallback: Groq Whisper ──────────────────────────────────────
            if settings.GROQ_API_KEY:
                try:
                    from groq import Groq
                    log_f.write("Falling back to Groq...\n")
                    client = Groq(api_key=settings.GROQ_API_KEY)
                    transcription = client.audio.transcriptions.create(
                        file=(f"audio{extension}", content),
                        model="whisper-large-v3-turbo",
                        language="en",
                        response_format="verbose_json",
                        temperature=0.0,
                    )
                    text = transcription.text or ""
                    log_f.write(f"Groq Result: {text}\n")
                    return {
                        "text": text,
                        "words": [], # simplified
                        "duration": None,
                        "language": "en",
                    }
                except Exception as e:
                    log_f.write(f"Groq Fallback Exception: {str(e)}\n")

        raise HTTPException(status_code=503, detail="No STT service available")
    finally:
        for p in [tmp_path, wav_path]:
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except:
                    pass


@router.post("/parse-order")
async def parse_order(
    transcript: str = Form(...),
    current_order: str = Form("[]"),
    session: TableSession = Depends(get_customer_session),
    db: Session = Depends(get_db),
):
    """
    Smart Voice Waiter — Parse transcript into order OPERATIONS.
    Supports: add, modify, delete intents + unavailable item detection.
    
    Accepts current_order JSON so the LLM knows what's already ordered.
    Returns: { actions: [...], unavailable: [...] }
    """
    import httpx
    from config import settings
    from difflib import SequenceMatcher

    if not transcript or not transcript.strip():
        return {"actions": [], "unavailable": []}

    # Parse current order context
    try:
        existing_order = json.loads(current_order) if current_order else []
    except json.JSONDecodeError:
        existing_order = []

    # Fetch menu from DB
    from models import MenuItem
    menu_items = (
        db.query(MenuItem)
        .filter(MenuItem.restaurant_id == session.restaurant_id, MenuItem.is_available == True)
        .all()
    )
    menu_data = [{"id": item.id, "name": item.name, "price": float(item.price)} for item in menu_items]
    menu_list = "\n".join([f"- {m['name']} (₹{m['price']})" for m in menu_data])

    # Build current order context string
    order_context = ""
    if existing_order:
        order_lines = [f"- {o.get('name','?')} × {o.get('qty',1)}" for o in existing_order]
        order_context = f"""
CUSTOMER'S CURRENT ORDER:
{chr(10).join(order_lines)}
"""

    system_prompt = f"""You are an intelligent voice waiter AI for an Indian restaurant POS system.
You understand ADD, MODIFY, and DELETE intents from voice transcripts.

AVAILABLE MENU ITEMS:
{menu_list}
{order_context}
STRICT OUTPUT FORMAT — respond with ONLY valid JSON, no explanation, no markdown:
{{
  "actions": [
    {{"op": "add", "name": "exact menu item name", "qty": number}},
    {{"op": "modify", "name": "exact menu item name", "qty": new_number}},
    {{"op": "delete", "name": "exact menu item name"}}
  ],
  "unavailable": ["item name that doesn't exist in menu"]
}}

RULES:
1. "name" MUST exactly match one of the AVAILABLE MENU ITEMS listed above.
2. "qty" must be a positive integer (for add/modify ops).
3. If customer says something that doesn't match ANY menu item, put it in "unavailable".
4. For delete ops, no qty is needed.

INTENT DETECTION:
- ADD: Default intent. "2 coke", "ek chai de do", "I want paneer" → op: "add"
- MODIFY: When customer wants to CHANGE quantity of an existing item.
  Triggers: "change X to Y", "make it Y", "X ko Y kar do", "instead of", "X ki jagah"
  → op: "modify" with new qty
- DELETE: When customer wants to REMOVE an item.
  Triggers: "remove X", "cancel X", "X hatao", "X nahi chahiye", "delete X", "no X"
  → op: "delete"

MATCHING RULES (Indian accent & Hindi/Hinglish):
- "kaafi"/"kaapi" → Filter Coffee | "chai"/"chaye"/"tea" → Chai
- "biriyani"/"biryaani" → Biryani | "dosa" → Masala Dosa
- "paneer" → Paneer Butter Masala | "dal" → Dal Tadka
- "roti"/"chapati" → Roti | "cold drink"/"soda" → Coke
- Quantity: "ek"→1, "do"→2, "teen"/"tin"→3, "char"→4, "paanch"→5
- English: "a"/"one"→1, "two"/"couple"→2, "three"→3, "four"→4, "five"→5
- Default qty = 1 if no quantity word
- Ignore fillers: please, aur, and, also, bhi, de do, give me

EXAMPLES:
Input: "do coke aur ek paneer butter masala"
Output: {{"actions":[{{"op":"add","name":"Coke","qty":2}},{{"op":"add","name":"Paneer Butter Masala","qty":1}}],"unavailable":[]}}

Input: "coke hatao aur roti teen kar do"
Output: {{"actions":[{{"op":"delete","name":"Coke"}},{{"op":"modify","name":"Roti","qty":3}}],"unavailable":[]}}

Input: "ek pizza aur do chai"
Output: {{"actions":[{{"op":"add","name":"Chai","qty":2}}],"unavailable":["pizza"]}}

Input: "remove paneer and add 3 naan"
Output: {{"actions":[{{"op":"delete","name":"Paneer Butter Masala"}},{{"op":"add","name":"Naan","qty":3}}],"unavailable":[]}}"""

    user_msg = f'Voice order transcript: "{transcript.strip()}"'

    # ── Fuzzy matching helper ───────────────────────────────────────
    menu_lookup = {m["name"]: m for m in menu_data}
    menu_names_lower = {m["name"].lower(): m["name"] for m in menu_data}

    def fuzzy_match(name):
        """Find closest menu item using difflib, return (matched_name, meta) or None."""
        if not name:
            return None
        # Exact match
        if name in menu_lookup:
            return (name, menu_lookup[name])
        # Case-insensitive match
        lower = name.lower().strip()
        if lower in menu_names_lower:
            matched = menu_names_lower[lower]
            return (matched, menu_lookup[matched])
        # Fuzzy match
        best_score = 0
        best_match = None
        for menu_name in menu_lookup.keys():
            score = SequenceMatcher(None, lower, menu_name.lower()).ratio()
            if score > best_score:
                best_score = score
                best_match = menu_name
        if best_score >= 0.55:
            return (best_match, menu_lookup[best_match])
        return None

    def process_llm_response(raw_text):
        """Parse and validate the LLM response with fuzzy matching."""
        cleaned = raw_text.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        
        # Handle both old format (list) and new format (dict with actions)
        if isinstance(data, list):
            # Old format compatibility: treat as all "add" operations
            actions = [{"op": "add", "name": item.get("name", ""), "qty": item.get("qty", 1)} for item in data]
            data = {"actions": actions, "unavailable": []}
        
        if not isinstance(data, dict):
            raise ValueError("Response is not a JSON object")
        
        raw_actions = data.get("actions", [])
        raw_unavailable = data.get("unavailable", [])
        
        validated_actions = []
        unavailable_items = list(raw_unavailable)
        
        for action in raw_actions:
            op = action.get("op", "add")
            name = action.get("name", "")
            qty = action.get("qty", 1)
            
            match = fuzzy_match(name)
            if match:
                matched_name, meta = match
                entry = {
                    "op": op,
                    "name": matched_name,
                    "menu_item_id": meta["id"],
                    "price": meta["price"],
                }
                if op != "delete":
                    entry["qty"] = max(1, int(qty))
                validated_actions.append(entry)
            else:
                # Item not found in menu
                if name and name.lower() not in [u.lower() for u in unavailable_items]:
                    unavailable_items.append(name)
        
        return {"actions": validated_actions, "unavailable": unavailable_items}

    # ── Primary: Sarvam AI Chat Completion ──────────────────────────
    sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
    if sarvam_key:
        try:
            print("[PARSE-ORDER] Using Sarvam AI LLM...")
            resp = httpx.post(
                "https://api.sarvam.ai/v1/chat/completions",
                headers={
                    "api-subscription-key": sarvam_key,
                    "Content-Type": "application/json",
                },
                json={
                    "model": "sarvam-m",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_msg},
                    ],
                    "max_tokens": 600,
                    "temperature": 0,
                },
                timeout=20.0,
            )
            if resp.status_code == 200:
                raw = resp.json()["choices"][0]["message"]["content"].strip()
                print(f"[PARSE-SARVAM] Raw: {raw}")
                result = process_llm_response(raw)
                print(f"[PARSE-SARVAM] ✅ {len(result['actions'])} actions, {len(result['unavailable'])} unavailable")
                return result
            else:
                print(f"[PARSE-SARVAM] ❌ Error {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"[PARSE-SARVAM] ❌ Failed: {e}")

    # ── Fallback: Groq LLM ──────────────────────────────────────────
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            print("[PARSE-ORDER] Falling back to Groq LLM...")
            client = Groq(api_key=settings.GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg},
                ],
                max_tokens=600, temperature=0, top_p=1,
            )
            raw = response.choices[0].message.content.strip()
            print(f"[PARSE-GROQ] Raw: {raw}")
            result = process_llm_response(raw)
            print(f"[PARSE-GROQ] ✅ {len(result['actions'])} actions, {len(result['unavailable'])} unavailable")
            return result
        except Exception as e:
            print(f"[PARSE-ORDER] Groq fallback error: {e}")
            logger.error(f"[PARSE-ORDER] Groq fallback error: {e}")

    return {"actions": [], "unavailable": [], "error": "No LLM service available"}


@router.post("/submit-order")
def submit_order_direct(
    items_json: str = Form(...),   # JSON: [{"menu_item_id":…, "name":…, "qty":…, "price":…}]
    session: TableSession = Depends(get_customer_session),
    db: Session = Depends(get_db),
):
    """
    Create an order directly from parsed items (no VoiceOrderLog required).
    Called after the Groq Whisper → LLM pipeline confirms the order.
    """
    try:
        items = json.loads(items_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid items JSON")

    if not items:
        raise HTTPException(status_code=400, detail="No items provided")

    restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
    gst_pct = float(restaurant.gst_percentage) if restaurant else 5.0

    subtotal = 0
    order_items_data = []
    for item in items:
        qty = max(1, int(item.get("qty", 1)))
        price = float(item.get("price", 0))
        subtotal += round(price * qty, 2)
        order_items_data.append({
            "menu_item_id": item["menu_item_id"],
            "quantity": qty,
            "unit_price": price,
            "special_instructions": item.get("special_instructions"),
        })

    gst_amount = round(subtotal * gst_pct / 100, 2)
    total_amount = round(subtotal + gst_amount, 2)

    from datetime import datetime as dt
    now = dt.utcnow()
    order_number = f"ORD-{now.strftime('%d%H%M%S')}-{session.table_id}"

    order = Order(
        id=str(uuid.uuid4()),
        restaurant_id=session.restaurant_id,
        order_number=order_number,
        order_type=OrderType.DINE_IN,
        order_source=OrderSource.VOICE_TABLE,
        status=OrderStatus.PLACED,
        table_number=session.table_number,
        session_id=session.id,
        subtotal=subtotal,
        gst_amount=gst_amount,
        total_amount=total_amount,
    )
    db.add(order)

    kot_count = 0
    for item_data in order_items_data:
        order_item = OrderItem(
            id=str(uuid.uuid4()),
            order_id=order.id,
            menu_item_id=item_data["menu_item_id"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            special_instructions=item_data.get("special_instructions"),
        )
        db.add(order_item)
        db.flush()

        kot_count += 1
        kot = KOT(
            id=str(uuid.uuid4()),
            order_id=order.id,
            order_item_id=order_item.id,
            kot_number=f"KOT-{order_number}-{kot_count}",
            status=OrderStatus.PLACED,
        )
        db.add(kot)

    session.total_orders = (session.total_orders or 0) + 1
    session.total_spent = float(session.total_spent or 0) + total_amount

    # Non-blocking inventory deduction
    try:
        from services.inventory_service import InventoryService
        for item_data in order_items_data:
            InventoryService.deduct_ingredients_for_menu_item(
                db, item_data["menu_item_id"], item_data["quantity"]
            )
    except Exception as e:
        logger.warning(f"[SUBMIT-ORDER] Inventory deduction failed (non-blocking): {e}")

    db.commit()

    active_kots = db.query(KOT).filter(
        KOT.status.in_([OrderStatus.PLACED.value, OrderStatus.PREPARING.value])
    ).count()
    estimated_wait = max(10, active_kots * 3)

    return {
        "success": True,
        "order_id": order.id,
        "order_number": order_number,
        "total": total_amount,
        "subtotal": subtotal,
        "gst": gst_amount,
        "items_count": len(order_items_data),
        "estimated_wait_minutes": estimated_wait,
    }


# ── Admin / Staff Routes ─────────────────────────────────────────────────

from routes.auth import get_current_user
from models import User

admin_router = APIRouter(prefix="/api/admin/tables", tags=["Table Management"])


@admin_router.post("/configure")
def configure_table(
    table_id: str = Form(...),
    table_number: str = Form(...),
    table_name: str = Form(""),
    capacity: int = Form(4),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update a table configuration."""
    existing = db.query(TableConfig).filter(TableConfig.table_id == table_id).first()

    if existing:
        existing.table_number = table_number
        existing.table_name = table_name
        existing.capacity = capacity
    else:
        tc = TableConfig(
            id=str(uuid.uuid4()),
            restaurant_id=str(current_user.restaurant_id),
            table_id=table_id,
            table_number=table_number,
            table_name=table_name,
            capacity=capacity,
        )
        db.add(tc)

    db.commit()
    return {"success": True, "table_id": table_id}


@admin_router.post("/{table_id}/close-session")
def close_table_session(
    table_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Close active session for a table (after billing)."""
    session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.status == SessionStatus.ACTIVE.value,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail=f"No active session for table {table_id}")

    session.status = SessionStatus.CLOSED.value
    session.session_end = datetime.utcnow()
    db.commit()

    return {"success": True, "session_id": session.id, "total_spent": float(session.total_spent or 0)}


@admin_router.get("/sessions")
def list_active_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all active table sessions for staff dashboard."""
    sessions = (
        db.query(TableSession)
        .filter(
            TableSession.restaurant_id == str(current_user.restaurant_id),
            TableSession.status == SessionStatus.ACTIVE.value,
        )
        .order_by(TableSession.session_start.desc())
        .all()
    )

    result = []
    for s in sessions:
        duration_mins = 0
        if s.session_start:
            duration_mins = int((datetime.utcnow() - s.session_start).total_seconds() / 60)

        result.append({
            "session_id": s.id,
            "table_id": s.table_id,
            "table_number": s.table_number,
            "pax": s.pax,
            "total_orders": s.total_orders or 0,
            "total_spent": float(s.total_spent or 0),
            "duration_minutes": duration_mins,
            "started_at": s.session_start.isoformat() + "Z" if s.session_start else None,
        })

    return {"sessions": result, "count": len(result)}
