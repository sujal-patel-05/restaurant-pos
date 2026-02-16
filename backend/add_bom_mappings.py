from database import SessionLocal
from models import Ingredient, BOMMaping, MenuItem, UnitType

def add_bom():
    db = SessionLocal()
    try:
        # Get Menu Item
        burger = db.query(MenuItem).filter(MenuItem.name.ilike("%Aloo Tikki Burger%")).first()
        if not burger:
            print("Burger not found!")
            return

        # Get Ingredients
        tomato = db.query(Ingredient).filter(Ingredient.name.ilike("%Tomato%")).first()
        cheese = db.query(Ingredient).filter(Ingredient.name.ilike("%Cheese Slices%")).first()

        if not tomato:
            print("Creating Tomato ingredient...")
            tomato = Ingredient(
                restaurant_id=burger.restaurant_id,
                name="Tomato",
                unit=UnitType.KILOGRAM,
                current_stock=10.0,
                reorder_level=2.0
            )
            db.add(tomato)
            db.commit()
            db.refresh(tomato)

        if not cheese:
             print("Creating Cheese ingredient...")
             cheese = Ingredient(
                restaurant_id=burger.restaurant_id,
                name="Cheese Slices",
                unit=UnitType.PIECES,
                current_stock=50.0,
                reorder_level=10.0
            )
             db.add(cheese)
             db.commit()
             db.refresh(cheese)

        # Add BOM Mappings
        # Check if already exists
        tomato_bom = db.query(BOMMaping).filter(
            BOMMaping.menu_item_id == burger.id,
            BOMMaping.ingredient_id == tomato.id
        ).first()

        if not tomato_bom:
            print("Adding Tomato to BOM...")
            tomato_bom = BOMMaping(
                menu_item_id=burger.id,
                ingredient_id=tomato.id,
                quantity_required=0.1  # 100g tomato per burger
            )
            db.add(tomato_bom)
        else:
            print("Tomato already in BOM.")

        cheese_bom = db.query(BOMMaping).filter(
            BOMMaping.menu_item_id == burger.id,
            BOMMaping.ingredient_id == cheese.id
        ).first()

        if not cheese_bom:
            print("Adding Cheese to BOM...")
            cheese_bom = BOMMaping(
                menu_item_id=burger.id,
                ingredient_id=cheese.id,
                quantity_required=1.0  # 1 slice per burger
            )
            db.add(cheese_bom)
        else:
            print("Cheese already in BOM.")

        db.commit()
        print("BOM updated successfully!")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    add_bom()
