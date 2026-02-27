from sqlalchemy import Column, String, DateTime, DECIMAL, ForeignKey, Integer, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from database import Base

class OrderStatus(str, enum.Enum):
    PENDING_ONLINE = "pending_online"  # Awaiting manager approval (Zomato/Swiggy)
    PLACED = "placed"
    PREPARING = "preparing"
    READY = "ready"
    SERVED = "served"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class OrderType(str, enum.Enum):
    DINE_IN = "dine_in"
    TAKEAWAY = "takeaway"
    DELIVERY = "delivery"

class OrderSource(str, enum.Enum):
    POS = "pos"           # Direct POS / walk-in
    ZOMATO = "zomato"     # Zomato online order
    SWIGGY = "swiggy"     # Swiggy online order
    WAITER = "waiter"     # Waiter tablet/mobile order
    VOICE_TABLE = "voice_table"  # Customer voice order from table device

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    order_number = Column(String(50), unique=True, nullable=False)
    order_type = Column(SQLEnum(OrderType), nullable=False, default=OrderType.DINE_IN)
    order_source = Column(SQLEnum(OrderSource), nullable=False, default=OrderSource.POS)
    status = Column(SQLEnum(OrderStatus), nullable=False, default=OrderStatus.PLACED)
    table_number = Column(String(20))
    delivery_address = Column(String(500))  # For online delivery orders
    platform_order_id = Column(String(100))  # Zomato/Swiggy order reference
    rejection_reason = Column(String(255))  # If rejected
    customer_name = Column(String(255))
    customer_phone = Column(String(20))
    special_instructions = Column(String)
    waiter_name = Column(String(255))  # Name of waiter who took the order
    session_id = Column(String(100), ForeignKey("table_sessions.id"), nullable=True)  # Voice table session
    voice_log_id = Column(String(36), ForeignKey("voice_order_logs.id"), nullable=True)
    subtotal = Column(DECIMAL(10, 2), default=0)
    gst_amount = Column(DECIMAL(10, 2), default=0)
    discount_amount = Column(DECIMAL(10, 2), default=0)
    total_amount = Column(DECIMAL(10, 2), default=0)
    created_by = Column(String(36), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    
    # Relationships
    restaurant = relationship("Restaurant", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    kot_items = relationship("KOT", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="order", cascade="all, delete-orphan")
    
    @property
    def is_online(self):
        return self.order_source in (OrderSource.ZOMATO, OrderSource.SWIGGY)

class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    menu_item_id = Column(String(36), ForeignKey("menu_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    special_instructions = Column(String)
    item_status = Column(SQLEnum(OrderStatus), default=OrderStatus.PLACED)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    order = relationship("Order", back_populates="order_items")
    menu_item = relationship("MenuItem", back_populates="order_items")
    kot_items = relationship("KOT", back_populates="order_item", cascade="all, delete-orphan")

class KOT(Base):
    __tablename__ = "kot"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    kot_number = Column(String(50), unique=True, nullable=False)
    order_item_id = Column(String(36), ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PLACED)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    order = relationship("Order", back_populates="kot_items")
    order_item = relationship("OrderItem", back_populates="kot_items")
