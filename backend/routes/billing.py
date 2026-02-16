from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas.billing_schemas import PaymentCreate, PaymentResponse, InvoiceResponse
from services.billing_service import BillingService
from routes.auth import get_current_user
from uuid import UUID

router = APIRouter(prefix="/api/billing", tags=["Billing & Payments"])

@router.post("/calculate/{order_id}")
def calculate_bill(
    order_id: UUID,
    discount_code: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate bill for an order"""
    result = BillingService.calculate_bill(db, order_id, discount_code)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/payment", response_model=dict)
def process_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process payment for an order"""
    result = BillingService.process_payment(
        db,
        payment_data.order_id,
        payment_data.payment_mode.value,
        payment_data.amount,
        payment_data.transaction_id
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/invoice/{order_id}", response_model=dict)
def generate_invoice(
    order_id: UUID,
    type: str = "thermal",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate invoice for an order
    type: 'thermal' or 'a4'
    """
    result = BillingService.generate_invoice(db, order_id, type)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/email/{order_id}", response_model=dict)
def email_invoice(
    order_id: UUID,
    email: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Email invoice to customer"""
    result = BillingService.email_invoice(db, order_id, email)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result
