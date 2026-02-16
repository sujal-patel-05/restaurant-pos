from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import datetime
from models.billing import PaymentMode

# Payment Schema
class PaymentCreate(BaseModel):
    order_id: UUID4
    payment_mode: PaymentMode
    amount: float
    transaction_id: Optional[str] = None

class PaymentResponse(PaymentCreate):
    id: UUID4
    payment_status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Invoice Schema
class InvoiceResponse(BaseModel):
    id: UUID4
    order_id: UUID4
    invoice_number: str
    pdf_url: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Discount Schema
class DiscountCreate(BaseModel):
    code: str
    description: Optional[str] = None
    discount_type: str  # 'percentage' or 'fixed'
    discount_value: float
    min_order_amount: float = 0
    max_discount_amount: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None

class DiscountResponse(DiscountCreate):
    id: UUID4
    restaurant_id: UUID4
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
