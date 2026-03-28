"""
setup_realistic_pricing.py
───────────────────────────
Sets production-realistic menu prices & ingredient costs so the
Revenue Intelligence Engine produces meaningful margin data.

Run once:  python setup_realistic_pricing.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from models import MenuItem, Ingredient, BOMMaping, UnitType
from decimal import Decimal

# ── Menu item prices (INR) ──────────────────────────────────────
MENU_PRICES = {
    "Aloo Tikki Burger":       Decimal("129.00"),
    "Mexican Aloo Tikki":      Decimal("159.00"),
    "Margherita Pizza":        Decimal("199.00"),
    "Veg Loaded Pizza":        Decimal("279.00"),
    "Regular Fries":           Decimal("89.00"),
    "Cheesy Fries":            Decimal("129.00"),
    "Coke":                    Decimal("49.00"),
    "Strawberry Thick Shake":  Decimal("149.00"),
}

# ── Ingredient master with realistic wholesale costs ────────────
# (name, unit, cost_per_unit, reorder_level, initial_stock)
INGREDIENTS = {
    "Burger Bun":        (UnitType.PIECES,     Decimal("5.00"),   50,  500),
    "Aloo Tikki Patty":  (UnitType.PIECES,     Decimal("8.00"),   40,  400),
    "Lettuce":           (UnitType.KILOGRAM,    Decimal("60.00"),  2,   20),
    "Tomato":            (UnitType.KILOGRAM,    Decimal("40.00"),  3,   30),
    "Onion":             (UnitType.KILOGRAM,    Decimal("30.00"),  3,   30),
    "Cheese Slices":     (UnitType.PIECES,      Decimal("12.00"),  30,  300),
    "Mexican Sauce":     (UnitType.LITER,       Decimal("180.00"), 1,   10),
    "Jalapenos":         (UnitType.KILOGRAM,    Decimal("200.00"), 1,   5),
    "Pizza Dough Base":  (UnitType.PIECES,      Decimal("15.00"),  30,  200),
    "Mozzarella Cheese": (UnitType.KILOGRAM,    Decimal("400.00"), 2,   15),
    "Pizza Sauce":       (UnitType.LITER,       Decimal("120.00"), 2,   10),
    "Capsicum":          (UnitType.KILOGRAM,    Decimal("50.00"),  2,   15),
    "Sweet Corn":        (UnitType.KILOGRAM,    Decimal("80.00"),  2,   10),
    "Olives":            (UnitType.KILOGRAM,    Decimal("350.00"), 1,   5),
    "Potato":            (UnitType.KILOGRAM,    Decimal("25.00"),  5,   50),
    "Cooking Oil":       (UnitType.LITER,       Decimal("140.00"), 3,   20),
    "Salt & Spices":     (UnitType.KILOGRAM,    Decimal("100.00"), 1,   10),
    "Cheese Sauce":      (UnitType.LITER,       Decimal("220.00"), 1,   8),
    "Coca-Cola Syrup":   (UnitType.LITER,       Decimal("90.00"),  2,   15),
    "CO2 Cartridge":     (UnitType.PIECES,      Decimal("25.00"),  5,   30),
    "Disposable Cup":    (UnitType.PIECES,      Decimal("2.50"),   50,  500),
    "Strawberry Puree":  (UnitType.LITER,       Decimal("250.00"), 1,   8),
    "Milk":              (UnitType.LITER,       Decimal("55.00"),  5,   30),
    "Ice Cream Base":    (UnitType.KILOGRAM,    Decimal("180.00"), 2,   10),
    "Sugar":             (UnitType.KILOGRAM,    Decimal("45.00"),  3,   20),
    "Ketchup":           (UnitType.LITER,       Decimal("110.00"), 2,   10),
    "Mayonnaise":        (UnitType.LITER,       Decimal("150.00"), 1,   8),
}

# ── Bill of Materials: ingredient usage per menu item ───────────
# item_name -> [(ingredient_name, quantity)]
BOM_RECIPES = {
    "Aloo Tikki Burger": [
        ("Burger Bun",       1.0),
        ("Aloo Tikki Patty", 1.0),
        ("Lettuce",          0.03),   # 30g
        ("Tomato",           0.05),   # 50g
        ("Onion",            0.03),   # 30g
        ("Ketchup",          0.02),   # 20ml
        ("Mayonnaise",       0.015),  # 15ml
    ],
    "Mexican Aloo Tikki": [
        ("Burger Bun",       1.0),
        ("Aloo Tikki Patty", 1.0),
        ("Lettuce",          0.03),
        ("Tomato",           0.05),
        ("Onion",            0.03),
        ("Cheese Slices",    1.0),
        ("Mexican Sauce",    0.025),  # 25ml
        ("Jalapenos",        0.02),   # 20g
        ("Mayonnaise",       0.015),
    ],
    "Margherita Pizza": [
        ("Pizza Dough Base",  1.0),
        ("Mozzarella Cheese", 0.10),  # 100g
        ("Pizza Sauce",       0.06),  # 60ml
        ("Tomato",            0.08),  # 80g
        ("Cooking Oil",       0.01),  # 10ml
        ("Salt & Spices",     0.005),
    ],
    "Veg Loaded Pizza": [
        ("Pizza Dough Base",  1.0),
        ("Mozzarella Cheese", 0.15),  # 150g
        ("Pizza Sauce",       0.07),  # 70ml
        ("Capsicum",          0.05),  # 50g
        ("Onion",             0.05),  # 50g
        ("Sweet Corn",        0.04),  # 40g
        ("Olives",            0.02),  # 20g
        ("Tomato",            0.06),  # 60g
        ("Cooking Oil",       0.015),
        ("Salt & Spices",     0.005),
    ],
    "Regular Fries": [
        ("Potato",       0.25),  # 250g
        ("Cooking Oil",  0.05),  # 50ml
        ("Salt & Spices", 0.005),
        ("Ketchup",      0.025), # 25ml sachet
    ],
    "Cheesy Fries": [
        ("Potato",       0.25),
        ("Cooking Oil",  0.05),
        ("Salt & Spices", 0.005),
        ("Cheese Sauce", 0.04),  # 40ml
        ("Ketchup",      0.025),
    ],
    "Coke": [
        ("Coca-Cola Syrup", 0.05),  # 50ml syrup
        ("CO2 Cartridge",   0.2),   # 1/5 of a cartridge
        ("Disposable Cup",  1.0),
    ],
    "Strawberry Thick Shake": [
        ("Strawberry Puree", 0.06),  # 60ml
        ("Milk",             0.20),  # 200ml
        ("Ice Cream Base",   0.05),  # 50g
        ("Sugar",            0.015), # 15g
        ("Disposable Cup",   1.0),
    ],
}


def run():
    db = SessionLocal()
    try:
        # Get restaurant id from first menu item
        first_item = db.query(MenuItem).first()
        if not first_item:
            print("❌ No menu items found. Seed the menu first.")
            return
        rid = str(first_item.restaurant_id)
        print(f"🏪 Restaurant ID: {rid}")

        # ── Step 1: Update menu prices ──────────────────────────
        print("\n📝 Updating menu prices...")
        for name, price in MENU_PRICES.items():
            item = db.query(MenuItem).filter(
                MenuItem.restaurant_id == rid,
                MenuItem.name.ilike(f"%{name}%")
            ).first()
            if item:
                old_price = item.price
                item.price = price
                print(f"  ✅ {name}: ₹{old_price} → ₹{price}")
            else:
                print(f"  ⚠️  {name} not found in DB — skipped")

        db.commit()

        # ── Step 2: Upsert ingredients with correct costs ───────
        print("\n🧂 Setting up ingredients...")
        ingredient_map = {}  # name -> Ingredient obj
        for ing_name, (unit, cost, reorder, stock) in INGREDIENTS.items():
            ing = db.query(Ingredient).filter(
                Ingredient.restaurant_id == rid,
                Ingredient.name.ilike(f"%{ing_name}%")
            ).first()
            if ing:
                ing.cost_per_unit = cost
                ing.reorder_level = Decimal(str(reorder))
                if float(ing.current_stock) < 1:
                    ing.current_stock = Decimal(str(stock))
                print(f"  ✅ Updated {ing_name}: ₹{cost}/{unit.value}")
            else:
                ing = Ingredient(
                    restaurant_id=rid,
                    name=ing_name,
                    unit=unit,
                    cost_per_unit=cost,
                    reorder_level=Decimal(str(reorder)),
                    current_stock=Decimal(str(stock)),
                )
                db.add(ing)
                print(f"  🆕 Created {ing_name}: ₹{cost}/{unit.value}")
            ingredient_map[ing_name] = ing

        db.commit()
        # Refresh to get IDs for new ingredients
        for name in ingredient_map:
            db.refresh(ingredient_map[name])

        # ── Step 3: Build BOM mappings ──────────────────────────
        print("\n📋 Setting up BOM (Bill of Materials)...")
        for item_name, recipe in BOM_RECIPES.items():
            mi = db.query(MenuItem).filter(
                MenuItem.restaurant_id == rid,
                MenuItem.name.ilike(f"%{item_name}%")
            ).first()
            if not mi:
                print(f"  ⚠️  Menu item '{item_name}' not found — skipped")
                continue

            # Delete old BOMs for this item and rebuild
            db.query(BOMMaping).filter(BOMMaping.menu_item_id == mi.id).delete()

            total_cost = Decimal("0")
            for ing_name, qty in recipe:
                ing = ingredient_map.get(ing_name)
                if not ing:
                    print(f"  ⚠️  Ingredient '{ing_name}' not found — skipped")
                    continue
                bom = BOMMaping(
                    menu_item_id=str(mi.id),
                    ingredient_id=str(ing.id),
                    quantity_required=Decimal(str(qty)),
                )
                db.add(bom)
                line_cost = Decimal(str(qty)) * ing.cost_per_unit
                total_cost += line_cost

            margin = mi.price - total_cost
            margin_pct = (margin / mi.price * 100) if mi.price > 0 else 0
            print(f"  ✅ {item_name}: Food Cost ₹{total_cost:.2f}  |  "
                  f"Margin ₹{margin:.2f} ({margin_pct:.0f}%)")

        db.commit()

        # ── Summary ─────────────────────────────────────────────
        print(f"\n{'='*60}")
        print("✅ Realistic pricing setup complete!")
        print(f"   Menu items updated:  {len(MENU_PRICES)}")
        print(f"   Ingredients set up:  {len(INGREDIENTS)}")
        print(f"   BOM recipes built:   {len(BOM_RECIPES)}")
        print(f"{'='*60}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    run()
