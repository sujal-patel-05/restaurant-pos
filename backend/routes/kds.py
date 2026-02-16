from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import KOT, Restaurant, Order, User, OrderStatus
from schemas.order_schemas import KOTResponse
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

@router.get("/", response_model=List[KOTResponse])
def get_active_kots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all active KOTs (not completed or cancelled)"""
    
    kots = db.query(KOT).join(Order).filter(
        Order.restaurant_id == current_user.restaurant_id,
        KOT.status.in_([OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY])
    ).order_by(KOT.created_at).all()
    
    return kots

@router.get("/all", response_model=List[KOTResponse])
def get_all_kots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all KOTs including completed"""
    
    kots = db.query(KOT).join(Order).filter(
        Order.restaurant_id == current_user.restaurant_id
    ).order_by(KOT.created_at.desc()).all()
    
    return kots

@router.put("/{kot_id}/status")
def update_kot_status(
    kot_id: UUID,
    status: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update KOT status"""
    result = OrderService.update_kot_status(db, kot_id, status)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result
