from sqlalchemy import Column, String, DateTime, DECIMAL, ForeignKey, Date, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from database import Base

class UnitType(str, enum.Enum):
    GRAM = "g"
    KILOGRAM = "kg"
    MILLILITER = "ml"
    LITER = "l"
    PIECES = "pcs"
    DOZEN = "dozen"

class Ingredient(Base):
    __tablename__ = "ingredients"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    unit = Column(SQLEnum(UnitType), nullable=False)
    current_stock = Column(DECIMAL(10, 2), default=0)
    reorder_level = Column(DECIMAL(10, 2), default=0)
    cost_per_unit = Column(DECIMAL(10, 2), default=0)
    supplier = Column(String(255))
    expiry_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    restaurant = relationship("Restaurant", back_populates="ingredients")
    bom_mappings = relationship("BOMMaping", back_populates="ingredient", cascade="all, delete-orphan")
    inventory_transactions = relationship("InventoryTransaction", back_populates="ingredient", cascade="all, delete-orphan")
    wastage_logs = relationship("WastageLog", back_populates="ingredient", cascade="all, delete-orphan")

class BOMMaping(Base):
    __tablename__ = "bom_mappings"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    menu_item_id = Column(String(36), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False)
    ingredient_id = Column(String(36), ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False)
    quantity_required = Column(DECIMAL(10, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    menu_item = relationship("MenuItem", back_populates="bom_mappings")
    ingredient = relationship("Ingredient", back_populates="bom_mappings")

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ingredient_id = Column(String(36), ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(50), nullable=False)  # 'purchase', 'deduction', 'wastage', 'adjustment', 'rollback'
    quantity = Column(DECIMAL(10, 2), nullable=False)
    previous_stock = Column(DECIMAL(10, 2), nullable=False)
    new_stock = Column(DECIMAL(10, 2), nullable=False)
    reference_type = Column(String(50))  # 'order', 'manual', 'wastage'
    reference_id = Column(String(36))
    notes = Column(String)
    created_by = Column(String(36), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    ingredient = relationship("Ingredient", back_populates="inventory_transactions")

class WastageLog(Base):
    __tablename__ = "wastage_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ingredient_id = Column(String(36), ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(DECIMAL(10, 2), nullable=False)
    reason = Column(String(255))  # 'expired', 'damaged', 'kitchen_waste'
    logged_by = Column(String(36), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    ingredient = relationship("Ingredient", back_populates="wastage_logs")
