from pydantic import BaseModel, UUID4
from typing import Optional, List
from datetime import datetime
from models.order import OrderStatus, OrderType
from schemas.menu_schemas import MenuItemResponse

# Order Item Schema
class OrderItemCreate(BaseModel):
    menu_item_id: UUID4
    quantity: int
    special_instructions: Optional[str] = None

class OrderItemResponse(OrderItemCreate):
    id: UUID4
    order_id: UUID4
    unit_price: float
    item_status: OrderStatus
    
    # Nested
    menu_item: Optional[MenuItemResponse] = None
    
    class Config:
        from_attributes = True

# Order Schemas
class OrderCreate(BaseModel):
    order_type: OrderType = OrderType.DINE_IN
    table_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    special_instructions: Optional[str] = None
    items: List[OrderItemCreate]
    discount_amount: float = 0

class OrderResponse(BaseModel):
    id: UUID4
    restaurant_id: UUID4
    order_number: str
    order_type: OrderType
    status: OrderStatus
    table_number: Optional[str]
    customer_name: Optional[str]
    subtotal: float
    gst_amount: float
    discount_amount: float
    total_amount: float
    created_at: datetime
    
    class Config:
        from_attributes = True

# KOT Schema
class KOTResponse(BaseModel):
    id: UUID4
    order_id: UUID4
    kot_number: str
    status: OrderStatus
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    
    # Nested relationships
    order_item: Optional[OrderItemResponse] = None
    order: Optional[OrderResponse] = None
    
    class Config:
        from_attributes = True

class KOTUpdateStatus(BaseModel):
    status: OrderStatus
