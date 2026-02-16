from pydantic import BaseModel, UUID4
from typing import Optional, List
from datetime import datetime

# Menu Category Schemas
class MenuCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    display_order: int = 0
    is_active: bool = True

class MenuCategoryCreate(MenuCategoryBase):
    pass

class MenuCategoryResponse(MenuCategoryBase):
    id: UUID4
    restaurant_id: UUID4
    created_at: datetime
    
    class Config:
        from_attributes = True

# Menu Item Schemas
class MenuItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category_id: Optional[UUID4] = None
    image_url: Optional[str] = None
    is_available: bool = True
    preparation_time: int = 15

class MenuItemCreate(MenuItemBase):
    pass


# BOM Mapping Schema
class BOMMappingCreate(BaseModel):
    ingredient_id: UUID4
    quantity_required: float

class MenuItemResponse(MenuItemBase):
    id: UUID4
    restaurant_id: UUID4
    created_at: datetime
    bom_mappings: List[BOMMappingCreate] = []
    
    class Config:
        from_attributes = True

class MenuItemWithBOM(MenuItemCreate):
    bom_mappings: List[BOMMappingCreate] = []

