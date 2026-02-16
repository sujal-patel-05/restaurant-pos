from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Ingredient, Restaurant
from schemas.inventory_schemas import (
    IngredientCreate, IngredientUpdate, IngredientResponse
)
from services.inventory_service import InventoryService
from uuid import UUID
from typing import List

router = APIRouter(prefix="/api/inventory", tags=["Inventory Management"])

# Helper function to get default restaurant
def get_default_restaurant(db: Session):
    """Get the first restaurant in the database (for demo purposes without auth)"""
    restaurant = db.query(Restaurant).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="No restaurant found. Please create a restaurant first.")
    return restaurant

# Ingredients
@router.post("/ingredients", response_model=IngredientResponse)
def create_ingredient(
    ingredient_data: IngredientCreate,
    db: Session = Depends(get_db)
):
    """Create a new ingredient"""
    restaurant = get_default_restaurant(db)
    
    # Check if ingredient name already exists
    existing = db.query(Ingredient).filter(
        Ingredient.restaurant_id == restaurant.id,
        Ingredient.name == ingredient_data.name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Ingredient '{ingredient_data.name}' already exists")
    
    new_ingredient = Ingredient(
        restaurant_id=restaurant.id,
        **ingredient_data.dict()
    )
    db.add(new_ingredient)
    db.commit()
    db.refresh(new_ingredient)
    return new_ingredient

@router.get("/ingredients", response_model=List[IngredientResponse])
def get_ingredients(
    db: Session = Depends(get_db)
):
    """Get all ingredients for the restaurant"""
    restaurant = get_default_restaurant(db)
    
    ingredients = db.query(Ingredient).filter(
        Ingredient.restaurant_id == restaurant.id
    ).all()
    return ingredients

@router.get("/ingredients/{ingredient_id}", response_model=IngredientResponse)
def get_ingredient(
    ingredient_id: UUID,
    db: Session = Depends(get_db)
):
    """Get a specific ingredient"""
    restaurant = get_default_restaurant(db)
    
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == str(ingredient_id),
        Ingredient.restaurant_id == restaurant.id
    ).first()
    
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    return ingredient

@router.put("/ingredients/{ingredient_id}", response_model=IngredientResponse)
def update_ingredient(
    ingredient_id: UUID,
    ingredient_data: IngredientUpdate,
    db: Session = Depends(get_db)
):
    """Update an ingredient"""
    restaurant = get_default_restaurant(db)
    
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == str(ingredient_id),
        Ingredient.restaurant_id == restaurant.id
    ).first()
    
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    # Check if new name conflicts with existing ingredient
    if ingredient_data.name and ingredient_data.name != ingredient.name:
        existing = db.query(Ingredient).filter(
            Ingredient.restaurant_id == restaurant.id,
            Ingredient.name == ingredient_data.name,
            Ingredient.id != str(ingredient_id)
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail=f"Ingredient '{ingredient_data.name}' already exists")
    
    for key, value in ingredient_data.dict(exclude_unset=True).items():
        setattr(ingredient, key, value)
    
    db.commit()
    db.refresh(ingredient)
    return ingredient

@router.delete("/ingredients/{ingredient_id}")
def delete_ingredient(
    ingredient_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete an ingredient"""
    # Note: We filter only by ID and not restaurant_id to allow deletion 
    # even if restaurant context is different (since auth is bypassed)
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == str(ingredient_id)
    ).first()
    
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    # Check if ingredient is used in any BOM mappings
    from models import BOMMaping
    bom_usage = db.query(BOMMaping).filter(
        BOMMaping.ingredient_id == str(ingredient_id)
    ).first()
    
    if bom_usage:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete '{ingredient.name}' - it is used in menu items. Remove from menu items first."
        )
    
    ingredient_name = ingredient.name
    db.delete(ingredient)
    db.commit()
    return {"message": f"Ingredient '{ingredient_name}' deleted successfully"}


# Alerts
@router.get("/alerts/low-stock")
def get_low_stock_alerts(
    db: Session = Depends(get_db)
):
    """Get low stock alerts"""
    restaurant = get_default_restaurant(db)
    alerts = InventoryService.get_low_stock_alerts(db, restaurant.id)
    return alerts

@router.get("/alerts/expiry")
def get_expiry_alerts(
    days: int = 7,
    db: Session = Depends(get_db)
):
    """Get expiry alerts"""
    restaurant = get_default_restaurant(db)
    alerts = InventoryService.get_expiry_alerts(db, restaurant.id, days)
    return alerts
