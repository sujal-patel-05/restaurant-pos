from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Order, Restaurant, User
from schemas.order_schemas import OrderCreate, OrderResponse
from services.order_service import OrderService
from routes.auth import get_current_user
from uuid import UUID
from typing import List

router = APIRouter(prefix="/api/orders", tags=["Order Management"])

# Helper function to get default restaurant and user
def get_default_restaurant(db: Session):
    """Get the first restaurant in the database (for demo purposes without auth)"""
    restaurant = db.query(Restaurant).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="No restaurant found. Please create a restaurant first.")
    return restaurant

def get_default_user(db: Session):
    """Get the first user in the database (for demo purposes without auth)"""
    user = db.query(User).first()
    if not user:
        raise HTTPException(status_code=404, detail="No user found. Please create a user first.")
    return user

@router.post("/", response_model=dict)
def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new order"""
    print(f"Received order creation request from {current_user.username} (Rest ID: {current_user.restaurant_id}): {order_data}")
    try:
        result = OrderService.create_order(
            db,
            current_user.restaurant_id,
            order_data.dict(),
            current_user.id
        )
    except Exception as e:
        print(f"Unexpected error in create_order route: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

    print(f"OrderService result: {result}")
    
    if not result.get("success"):
        error_msg = result.get("error")
        details = result.get("details")
        
        # Enhanced error formatting for inventory issues
        if details:
            if "missing_ingredients" in details:
                missing = details["missing_ingredients"]
                formatted_missing = ", ".join([
                    f"{m['ingredient_name']} (Need {m['required']}{m['unit']}, Has {m['available']}{m['unit']})" 
                    for m in missing
                ])
                error_msg = f"Insufficient stock: {formatted_missing}"
            elif "error" in details:
                error_msg = details["error"]
                
        print(f"Order creation failed: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    
    return result

@router.get("/", response_model=List[OrderResponse])
def get_orders(
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all orders for the restaurant"""
    
    query = db.query(Order).filter(
        Order.restaurant_id == current_user.restaurant_id
    )
    
    if status:
        query = query.filter(Order.status == status)
    
    orders = query.order_by(Order.created_at.desc()).all()
    return orders

@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific order"""
    
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.restaurant_id == current_user.restaurant_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order

@router.put("/{order_id}/status")
def update_order_status(
    order_id: UUID,
    status: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update order status"""
    # Verify order belongs to user's restaurant
    order = db.query(Order).filter(Order.id == order_id, Order.restaurant_id == current_user.restaurant_id).first()
    if not order:
         raise HTTPException(status_code=404, detail="Order not found")

    result = OrderService.update_order_status(db, order_id, status)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.delete("/{order_id}")
def cancel_order(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel an order"""
    # Verify order belongs to user's restaurant
    order = db.query(Order).filter(Order.id == order_id, Order.restaurant_id == current_user.restaurant_id).first()
    if not order:
         raise HTTPException(status_code=404, detail="Order not found")
         
    result = OrderService.cancel_order(db, order_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


# ─── Waiter Endpoints ────────────────────────────────────────

@router.get("/waiter/active")
def get_waiter_active_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get active orders placed by the logged-in waiter"""
    from models.order import OrderSource, OrderStatus as OS
    from sqlalchemy import and_
    
    orders = db.query(Order).filter(
        and_(
            Order.restaurant_id == str(current_user.restaurant_id),
            Order.created_by == str(current_user.id),
            Order.status.notin_([OS.COMPLETED, OS.CANCELLED]),
        )
    ).order_by(Order.created_at.desc()).all()
    
    results = []
    for o in orders:
        items = []
        for oi in o.order_items:
            mi = oi.menu_item
            items.append({
                "name": mi.name if mi else "Unknown",
                "quantity": oi.quantity,
                "unit_price": float(oi.unit_price),
                "status": oi.item_status.value if oi.item_status else "placed",
            })
        results.append({
            "id": o.id,
            "order_number": o.order_number,
            "table_number": o.table_number,
            "status": o.status.value,
            "items": items,
            "total_amount": float(o.total_amount or 0),
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })
    
    return {"orders": results, "count": len(results)}


# ─── Online Order Endpoints (Zomato/Swiggy Simulation) ───────

@router.get("/online/pending")
def get_pending_online_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all pending Zomato/Swiggy orders awaiting approval"""
    from services.online_order_service import OnlineOrderService
    orders = OnlineOrderService.get_pending_orders(db, str(current_user.restaurant_id))
    return {"orders": orders, "count": len(orders)}


@router.post("/online/{order_id}/approve")
def approve_online_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a pending online order — generates KOTs and deducts inventory"""
    from services.online_order_service import OnlineOrderService
    result = OnlineOrderService.approve_order(db, order_id, str(current_user.id))
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@router.post("/online/{order_id}/reject")
def reject_online_order(
    order_id: str,
    reason: str = "Restaurant is busy",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a pending online order"""
    from services.online_order_service import OnlineOrderService
    result = OnlineOrderService.reject_order(db, order_id, reason)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result
