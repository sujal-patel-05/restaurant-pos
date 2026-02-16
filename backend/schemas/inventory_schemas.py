from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import datetime, date
from models.inventory import UnitType

# Ingredient Schemas
class IngredientBase(BaseModel):
    name: str
    unit: UnitType
    current_stock: float = 0
    reorder_level: float = 0
    cost_per_unit: float = 0
    supplier: Optional[str] = None
    expiry_date: Optional[date] = None

class IngredientCreate(IngredientBase):
    pass

class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    current_stock: Optional[float] = None
    reorder_level: Optional[float] = None
    cost_per_unit: Optional[float] = None
    supplier: Optional[str] = None
    expiry_date: Optional[date] = None

class IngredientResponse(IngredientBase):
    id: UUID4
    restaurant_id: UUID4
    created_at: datetime
    
    class Config:
        from_attributes = True

# Wastage Log Schema
class WastageLogCreate(BaseModel):
    ingredient_id: UUID4
    quantity: float
    reason: Optional[str] = None

class WastageLogResponse(WastageLogCreate):
    id: UUID4
    logged_by: Optional[UUID4]
    created_at: datetime
    
    class Config:
        from_attributes = True
