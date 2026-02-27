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
    session_id = f"SESSION-{table_id}-{now.strftime('%Y%m%d-%H%M%S')}"

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
