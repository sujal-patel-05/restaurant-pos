from sqlalchemy import Column, String, DateTime, Boolean, DECIMAL, ForeignKey, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database import Base

class MenuCategory(Base):
    __tablename__ = "menu_categories"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    restaurant = relationship("Restaurant", back_populates="menu_categories")
    menu_items = relationship("MenuItem", back_populates="category")

class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(String(36), ForeignKey("menu_categories.id", ondelete="SET NULL"))
    name = Column(String(255), nullable=False)
    description = Column(String)
    price = Column(DECIMAL(10, 2), nullable=False)
    image_url = Column(String(500))
    is_available = Column(Boolean, default=True)
    preparation_time = Column(Integer, default=15)  # minutes
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    restaurant = relationship("Restaurant", back_populates="menu_items")
    category = relationship("MenuCategory", back_populates="menu_items")
    bom_mappings = relationship("BOMMaping", back_populates="menu_item", cascade="all, delete-orphan")
    order_items = relationship("OrderItem", back_populates="menu_item")
