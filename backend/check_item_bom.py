from database import SessionLocal
from models import Ingredient, BOMMaping, MenuItem

def check_item_bom(item_name):
    db = SessionLocal()
    try:
        menu_item = db.query(MenuItem).filter(MenuItem.name.ilike(f"%{item_name}%")).first()
        if not menu_item:
            print(f"Item '{item_name}' not found.")
            return

        print(f"BOM for '{menu_item.name}':")
        boms = db.query(BOMMaping).filter(BOMMaping.menu_item_id == menu_item.id).all()
        
        if not boms:
            print(" - No BOM mappings found.")
        else:
            for bom in boms:
                ingredient = db.query(Ingredient).filter(Ingredient.id == bom.ingredient_id).first()
                print(f" - {ingredient.name}: {bom.quantity_required} {ingredient.unit.value}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_item_bom("Aloo Tikki Burger")
