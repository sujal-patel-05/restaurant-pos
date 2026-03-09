from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import KOT, Restaurant, Order, OrderItem, User, OrderStatus
from schemas.order_schemas import KOTTicketResponse
from services.order_service import OrderService
from routes.auth import get_current_user
from uuid import UUID
from typing import List

router = APIRouter(prefix="/api/kds", tags=["Kitchen Display System"])

# Helper function to get default restaurant
def get_default_restaurant(db: Session):
    """Get the first restaurant in the database (for demo purposes without auth)"""
    restaurant = db.query(Restaurant).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="No restaurant found. Please create a restaurant first.")
    return restaurant


def serialize_kot(kot: KOT) -> dict:
    order = getattr(kot, "order", None)
    order_item = getattr(kot, "order_item", None)
    menu_item = getattr(order_item, "menu_item", None) if order_item else None

    item_notes = None
    if order_item and getattr(order_item, "special_instructions", None):
        item_notes = order_item.special_instructions
    elif order and getattr(order, "special_instructions", None):
        item_notes = order.special_instructions

    item_payload = {
        "id": getattr(order_item, "id", None),
        "menu_item_id": getattr(order_item, "menu_item_id", None),
        "name": getattr(menu_item, "name", None) or "Unknown Item",
        "quantity": int(getattr(order_item, "quantity", 1) or 1),
        "notes": item_notes,
        "unit_price": float(getattr(order_item, "unit_price", 0) or 0),
        "item_status": getattr(order_item, "item_status", None),
    }

    return {
        "id": kot.id,
        "order_id": kot.order_id,
        "kot_number": kot.kot_number,
        "status": kot.status,
        "started_at": kot.started_at,
        "completed_at": kot.completed_at,
        "created_at": kot.created_at,
        "order_number": getattr(order, "order_number", None),
        "order_type": getattr(getattr(order, "order_type", None), "value", None),
        "order_source": getattr(getattr(order, "order_source", None), "value", None),
        "table_number": getattr(order, "table_number", None),
        "waiter_name": getattr(order, "waiter_name", None),
        "customer_name": getattr(order, "customer_name", None),
        "special_instructions": getattr(order, "special_instructions", None),
        "items": [item_payload],
        "order": {
            "id": getattr(order, "id", None),
            "order_number": getattr(order, "order_number", None),
            "order_type": getattr(getattr(order, "order_type", None), "value", None),
            "order_source": getattr(getattr(order, "order_source", None), "value", None),
            "table_number": getattr(order, "table_number", None),
            "waiter_name": getattr(order, "waiter_name", None),
            "customer_name": getattr(order, "customer_name", None),
            "special_instructions": getattr(order, "special_instructions", None),
            "created_at": getattr(order, "created_at", None),
        },
    }

@router.get("/", response_model=List[KOTTicketResponse])
def get_active_kots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all active KOTs (not completed or cancelled)"""
    
    kots = db.query(KOT).join(Order).options(
        joinedload(KOT.order),
        joinedload(KOT.order_item).joinedload(OrderItem.menu_item)
    ).filter(
        Order.restaurant_id == current_user.restaurant_id,
        KOT.status.in_([OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY])
    ).order_by(KOT.created_at).all()
    
    return [serialize_kot(kot) for kot in kots]

@router.get("/all", response_model=List[KOTTicketResponse])
def get_all_kots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all KOTs including completed"""
    
    kots = db.query(KOT).join(Order).options(
        joinedload(KOT.order),
        joinedload(KOT.order_item).joinedload(OrderItem.menu_item)
    ).filter(
        Order.restaurant_id == current_user.restaurant_id
    ).order_by(KOT.created_at.desc()).all()
    
    return [serialize_kot(kot) for kot in kots]

@router.put("/{kot_id}/status")
def update_kot_status(
    kot_id: UUID,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update KOT status"""
    # Verify status is valid
    valid_statuses = [s.value for s in OrderStatus]
    if status not in valid_statuses:
         raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    # Use service to update
    result = OrderService.update_kot_status(db, kot_id, status)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result
