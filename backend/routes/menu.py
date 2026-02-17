from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import MenuItem, MenuCategory, BOMMaping, Restaurant
from schemas.menu_schemas import (
    MenuItemCreate, MenuItemResponse, MenuItemWithBOM,
    MenuCategoryCreate, MenuCategoryResponse
)
from uuid import UUID
from typing import List
from fastapi import File, UploadFile
import shutil
import os
from pathlib import Path

router = APIRouter(prefix="/api/menu", tags=["Menu Management"])

# Helper function to get default restaurant
def get_default_restaurant(db: Session):
    """Get the first restaurant in the database (for demo purposes without auth)"""
    restaurant = db.query(Restaurant).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="No restaurant found. Please create a restaurant first.")
    return restaurant

# Categories
@router.post("/categories", response_model=MenuCategoryResponse)
def create_category(
    category_data: MenuCategoryCreate,
    db: Session = Depends(get_db)
):
    """Create a new menu category"""
    restaurant = get_default_restaurant(db)
    
    new_category = MenuCategory(
        restaurant_id=restaurant.id,
        **category_data.dict()
    )
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category

@router.get("/categories", response_model=List[MenuCategoryResponse])
def get_categories(
    db: Session = Depends(get_db)
):
    """Get all categories for the restaurant"""
    restaurant = get_default_restaurant(db)
    
    categories = db.query(MenuCategory).filter(
        MenuCategory.restaurant_id == restaurant.id
    ).order_by(MenuCategory.display_order).all()
    return categories

@router.put("/categories/{category_id}", response_model=MenuCategoryResponse)
def update_category(
    category_id: UUID,
    category_data: MenuCategoryCreate,
    db: Session = Depends(get_db)
):
    """Update a category"""
    try:
        restaurant = get_default_restaurant(db)
        
        category = db.query(MenuCategory).filter(
            MenuCategory.id == str(category_id),
            MenuCategory.restaurant_id == restaurant.id
        ).first()
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        for key, value in category_data.dict(exclude_unset=True).items():
            setattr(category, key, value)
        
        db.commit()
        db.refresh(category)
        return category
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating category: {str(e)}")

@router.delete("/categories/{category_id}")
def delete_category(
    category_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a category"""
    try:
        restaurant = get_default_restaurant(db)
        
        category = db.query(MenuCategory).filter(
            MenuCategory.id == str(category_id),
            MenuCategory.restaurant_id == restaurant.id
        ).first()
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check if category has items
        # Ensure we filter with string ID here as well if needed, though SQLAlchemy usually handles this relationship check okay if the FK is set up right. 
        # But to be safe, we rely on the object we just found. 
        # Actually, let's look at the original code: items_count = db.query(MenuItem).filter(MenuItem.category_id == category_id).count()
        # MenuItem.category_id is a String column. category_id is a UUID object. This DEFINITELY needs conversion.
        
        items_count = db.query(MenuItem).filter(MenuItem.category_id == str(category_id)).count()
        if items_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete category with {items_count} items. Please reassign or delete items first."
            )
        
        db.delete(category)
        db.commit()
        return {"message": "Category deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting category: {str(e)}")

# Menu Items
@router.post("/items", response_model=MenuItemResponse)
def create_menu_item(
    item_data: MenuItemWithBOM,
    db: Session = Depends(get_db)
):
    """Create a new menu item with BOM mappings"""
    try:
        restaurant = get_default_restaurant(db)
        
        # Create menu item
        menu_item_dict = item_data.dict(exclude={"bom_mappings"})
        
        # Explicitly convert UUIDs to strings for SQLite
        if menu_item_dict.get('category_id'):
            menu_item_dict['category_id'] = str(menu_item_dict['category_id'])
            
        new_item = MenuItem(
            restaurant_id=restaurant.id,
            **menu_item_dict
        )
        db.add(new_item)
        db.flush()
        
        # Create BOM mappings
        for bom_data in item_data.bom_mappings:
            bom_mapping = BOMMaping(
                menu_item_id=new_item.id,
                ingredient_id=str(bom_data.ingredient_id), # Ensure ingredient_id is also string
                quantity_required=bom_data.quantity_required
            )
            db.add(bom_mapping)
        
        db.commit()
        db.refresh(new_item)
        return new_item
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating menu item: {str(e)}")

@router.get("/items", response_model=List[MenuItemResponse])
def get_menu_items(
    db: Session = Depends(get_db),
    category_id: UUID = None
):
    """Get all menu items for the restaurant"""
    restaurant = get_default_restaurant(db)
    
    query = db.query(MenuItem).filter(
        MenuItem.restaurant_id == restaurant.id
    )
    
    if category_id:
        query = query.filter(MenuItem.category_id == category_id)
    
    # Eager load BOM mappings
    from sqlalchemy.orm import joinedload
    items = query.options(joinedload(MenuItem.bom_mappings)).all()
    return items

@router.get("/items/{item_id}", response_model=MenuItemResponse)
def get_menu_item(
    item_id: UUID,
    db: Session = Depends(get_db)
):
    """Get a specific menu item"""
    restaurant = get_default_restaurant(db)
    
    # Eager load BOM mappings
    from sqlalchemy.orm import joinedload
    item = db.query(MenuItem).options(joinedload(MenuItem.bom_mappings)).filter(
        MenuItem.id == str(item_id),
        MenuItem.restaurant_id == restaurant.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    return item

@router.put("/items/{item_id}", response_model=MenuItemResponse)
def update_menu_item(
    item_id: UUID,
    item_data: MenuItemWithBOM,  # Changed from MenuItemCreate to include BOM
    db: Session = Depends(get_db)
):
    """Update a menu item and its BOM mappings"""
    try:
        restaurant = get_default_restaurant(db)
        
        item = db.query(MenuItem).filter(
            MenuItem.id == str(item_id),
            MenuItem.restaurant_id == restaurant.id
        ).first()
        
        if not item:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        # Update basic fields
        update_data = item_data.dict(exclude={"bom_mappings"}, exclude_unset=True)
        if update_data.get('category_id'):
            update_data['category_id'] = str(update_data['category_id'])
            
        for key, value in update_data.items():
            setattr(item, key, value)
        
        # Update BOM mappings if provided
        if item_data.bom_mappings is not None:
            # Delete existing mappings
            db.query(BOMMaping).filter(BOMMaping.menu_item_id == item.id).delete()
            
            # Create new mappings
            for bom_data in item_data.bom_mappings:
                bom_mapping = BOMMaping(
                    menu_item_id=item.id,
                    ingredient_id=str(bom_data.ingredient_id),
                    quantity_required=bom_data.quantity_required
                )
                db.add(bom_mapping)
        
        db.commit()
        db.refresh(item)
        return item
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating menu item: {str(e)}")

@router.delete("/items/{item_id}")
def delete_menu_item(
    item_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a menu item"""
    try:
        restaurant = get_default_restaurant(db)
        
        # Explicitly convert UUID to string for SQLite
        item_id_str = str(item_id)
        
        item = db.query(MenuItem).filter(
            MenuItem.id == item_id_str,
            MenuItem.restaurant_id == restaurant.id
        ).first()
        
        if not item:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        db.delete(item)
        db.commit()
        return {"message": "Menu item deleted successfully"}
    except HTTPException:
        raise
        db.rollback()
        print(f"Error deleting menu item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting menu item: {str(e)}")

@router.post("/items/{item_id}/image")
async def upload_item_image(
    item_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload an image for a menu item"""
    try:
        restaurant = get_default_restaurant(db)
        
        # Verify item exists
        item = db.query(MenuItem).filter(
            MenuItem.id == str(item_id),
            MenuItem.restaurant_id == restaurant.id
        ).first()
        
        if not item:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        # Create directory if not exists
        upload_dir = Path("public/images/menu_items")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        file_extension = os.path.splitext(file.filename)[1]
        filename = f"{item_id}{file_extension}"
        file_path = upload_dir / filename
        
        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Update database
        # Store relative path for frontend access
        image_url = f"/public/images/menu_items/{filename}"
        item.image_url = image_url
        db.commit()
        db.refresh(item)
        
        return {"image_url": image_url}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")
