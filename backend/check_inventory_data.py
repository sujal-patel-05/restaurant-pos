from database import SessionLocal
from models import Ingredient, BOMMaping, MenuItem

def check_inventory():
    db = SessionLocal()
    try:
        ingredients = db.query(Ingredient).all()
        print(f"Total Ingredients: {len(ingredients)}")
        for ing in ingredients:
            print(f" - {ing.name} ({ing.current_stock} {ing.unit.value})")
            
        boms = db.query(BOMMaping).all()
        print(f"\nTotal BOM Mappings: {len(boms)}")
        for bom in boms:
            menu_item = db.query(MenuItem).filter(MenuItem.id == bom.menu_item_id).first()
            ingredient = db.query(Ingredient).filter(Ingredient.id == bom.ingredient_id).first()
            item_name = menu_item.name if menu_item else "Unknown Item"
            ing_name = ingredient.name if ingredient else "Unknown Ingredient"
            print(f" - {item_name} requires {bom.quantity_required} {ingredient.unit.value if ingredient else ''} of {ing_name}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_inventory()
