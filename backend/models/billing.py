from sqlalchemy import Column, String, DateTime, DECIMAL, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from database import Base

class PaymentMode(str, enum.Enum):
    CASH = "cash"
    UPI = "upi"
    CARD = "card"
    WALLET = "wallet"

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    payment_mode = Column(SQLEnum(PaymentMode), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    transaction_id = Column(String(255))
    payment_status = Column(String(50), default="completed")  # 'completed', 'failed', 'pending'
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    order = relationship("Order", back_populates="payments")

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    invoice_number = Column(String(50), unique=True, nullable=False)
    pdf_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    order = relationship("Order", back_populates="invoices")

class Discount(Base):
    __tablename__ = "discounts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(String)
    discount_type = Column(String(20), nullable=False)  # 'percentage', 'fixed'
    discount_value = Column(DECIMAL(10, 2), nullable=False)
    min_order_amount = Column(DECIMAL(10, 2), default=0)
    max_discount_amount = Column(DECIMAL(10, 2))
    valid_from = Column(DateTime)
    valid_until = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    restaurant = relationship("Restaurant", back_populates="discounts")
