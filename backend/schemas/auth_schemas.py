from pydantic import BaseModel, EmailStr, UUID4
from typing import Optional
from datetime import datetime
from models.restaurant import UserRole

# Restaurant Schemas
class RestaurantBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    gst_percentage: float = 5.00

class RestaurantCreate(RestaurantBase):
    pass

class RestaurantResponse(RestaurantBase):
    id: UUID4
    created_at: datetime
    
    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.CASHIER

class UserCreate(UserBase):
    password: str
    restaurant_id: UUID4

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: UUID4
    restaurant_id: UUID4
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
