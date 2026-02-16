
import sys
import os
from uuid import uuid4, UUID
from datetime import datetime

# Add current directory to path
current_dir = os.getcwd()
if current_dir not in sys.path:
    sys.path.append(current_dir)

try:
    from database import SessionLocal
    from services.order_service import OrderService
    # Try direct imports to bypass potential __init__ issues or debug them
    from models.restaurant import Restaurant, User
    from models.menu import MenuItem, MenuCategory as Category
    from models.inventory import Ingredient, BOMMaping, UnitType
    from models.order import OrderType
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def reproduce():
    db = SessionLocal()
    try:
        # 1. Get or create dependencies
        restaurant = db.query(Restaurant).first()
        if not restaurant:
            restaurant = Restaurant(id=str(uuid4()), name="Test Rest", address="Tv", contact_number="123")
            db.add(restaurant)
            db.commit()
            
        user = db.query(User).first()
        if not user:
            user = User(id=str(uuid4()), username="test", password_hash="hash", role="admin", restaurant_id=restaurant.id)
            db.add(user)
            db.commit()

        category = db.query(Category).first()
        if not category:
            category = Category(id=str(uuid4()), name="Test Cat", restaurant_id=restaurant.id)
            db.add(category)
            db.commit()

        item = db.query(MenuItem).first()
        if not item:
            item = MenuItem(
                id=str(uuid4()), 
                name="Test Item", 
                price=100, 
                category_id=category.id, 
                restaurant_id=restaurant.id,
                is_vegetarian=True,
                is_available=True
            )
            db.add(item)
            db.commit()

        # Create Ingredients and BOM if not exists
        ingredient = db.query(Ingredient).first()
        if not ingredient:
            ingredient = Ingredient(
                id=str(uuid4()),
                restaurant_id=restaurant.id,
                name="Test Ing",
                unit=UnitType.KG,
                cost_per_unit=10,
                current_stock=100,
                reorder_level=10
            )
            db.add(ingredient)
            db.commit()
        
        bom = db.query(BOMMaping).filter_by(menu_item_id=item.id).first()
        if not bom:
            bom = BOMMaping(
                id=str(uuid4()),
                menu_item_id=item.id,
                ingredient_id=ingredient.id,
                quantity_required=0.1
            )
            db.add(bom)
            db.commit()

        # 2. Prepare Order Data (simulating what Pydantic returns)
        # Pydantic via .dict() returns actual UUID objects for UUID fields
        order_data = {
            "order_type": "dine_in",
            "table_number": "1",
            "items": [
                {
                    "menu_item_id": UUID(item.id), # Pydantic converts str to UUID
                    "quantity": 1
                }
            ]
        }
        
        # NOTE: Pydantic .dict() might return UUID objects.
        # Let's verify if that's what triggers it.
        
        print(f"Calling create_order with payload having UUID objects...")

        # 3. Call Service
        try:
            result = OrderService.create_order(
                db,
                UUID(restaurant.id),
                order_data,
                UUID(user.id)
            )
            print("Result:", result)
        except Exception as e:
            print("CAUGHT EXCEPTION:")
            import traceback
            traceback.print_exc()

    finally:
        db.close()

if __name__ == "__main__":
    reproduce()
