from database import SessionLocal
from models import BOMMaping, MenuItem
from uuid import UUID

def test_bom_lookup():
    db = SessionLocal()
    try:
        # Get a menu item that has BOMs
        item = db.query(MenuItem).join(BOMMaping).first()
        if not item:
            print("No items with BOM found in DB.")
            return

        print(f"Found item: {item.name} (ID: {item.id}, Type: {type(item.id)})")
        
        # Test lookup with String
        print(f"\nLooking up BOM with String ID: '{str(item.id)}'")
        boms_str = db.query(BOMMaping).filter(BOMMaping.menu_item_id == str(item.id)).all()
        print(f"Found {len(boms_str)} BOMs using String.")

        # Test lookup with UUID object
        print(f"\nLooking up BOM with UUID object: {UUID(str(item.id))}")
        boms_uuid = db.query(BOMMaping).filter(BOMMaping.menu_item_id == UUID(str(item.id))).all()
        print(f"Found {len(boms_uuid)} BOMs using UUID object.")
        
        if len(boms_str) > 0 and len(boms_uuid) == 0:
            print("\nCONCLUSION: UUID object lookup FAILS. Must use String.")
        elif len(boms_str) == len(boms_uuid):
            print("\nCONCLUSION: Both lookups work.")
        else:
            print("\nCONCLUSION: Something else is wrong.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_bom_lookup()
