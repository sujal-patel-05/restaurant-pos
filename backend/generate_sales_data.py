"""
generate_sales_data.py
──────────────────────
Generates 3 months of realistic, synthetic POS transaction data.
Patterns modelled:
  • Peak hours: lunch (12-14) and dinner (19-22)
  • Weekends get 30-50 % more orders
  • Slight random monthly growth trend
  • Combo ordering: burgers often paired with fries + drinks
  • Payment split: ~40 % UPI, ~35 % cash, ~20 % card, ~5 % wallet
  • 5 % of orders are cancelled
  • 10 % of completed orders receive a discount (5-15 %)
  • Order types: 50 % dine-in, 30 % takeaway, 20 % delivery
"""

import sys, os, random, uuid, math
from datetime import datetime, timedelta, date
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine, Base
from models import (
    MenuItem, Restaurant, Order, OrderItem, Payment, KOT
)
from models.order import OrderStatus, OrderType, OrderSource
from models.billing import PaymentMode

# ── CONFIG ──────────────────────────────────────────────────────
DAYS_BACK        = 90          # 3 months
BASE_ORDERS_MIN  = 55          # weekday min orders
BASE_ORDERS_MAX  = 85          # weekday max orders
WEEKEND_BOOST    = 1.35        # multiplier for Sat/Sun
GST_RATE         = 0.05        # 5 % GST
CANCEL_RATE      = 0.05        # 5 % cancelled
DISCOUNT_RATE    = 0.10        # 10 % get a discount
DISCOUNT_RANGE   = (5, 15)     # discount % range

# Peak hour weights (hour → relative probability)
HOUR_WEIGHTS = {
    9: 2, 10: 5, 11: 8,
    12: 18, 13: 20, 14: 12,
    15: 5, 16: 4, 17: 6,
    18: 10, 19: 18, 20: 22, 21: 18, 22: 8,
    23: 2
}

# Order type weights
ORDER_TYPES = [
    (OrderType.DINE_IN,  0.50),
    (OrderType.TAKEAWAY,  0.30),
    (OrderType.DELIVERY,  0.20),
]

# Order source weights (POS vs Online platforms)
# ~30% of all orders come from online aggregators
ORDER_SOURCES = [
    (OrderSource.POS,     0.70),
    (OrderSource.ZOMATO,  0.18),
    (OrderSource.SWIGGY,  0.12),
]

# Payment mode weights
PAYMENT_MODES = [
    (PaymentMode.UPI,    0.40),
    (PaymentMode.CASH,   0.35),
    (PaymentMode.CARD,   0.20),
    (PaymentMode.WALLET, 0.05),
]

# Combo patterns: (main, sides, drink probability)
# Each order picks 1-3 items; combos make it realistic
COMBO_TEMPLATES = [
    # burger combos (most popular)
    {"mains": ["Aloo Tikki Burger"], "sides": ["Regular Fries"], "drink": "Coke", "weight": 15},
    {"mains": ["Mexican Aloo Tikki"], "sides": ["Cheesy Fries"], "drink": "Strawberry Thick Shake", "weight": 10},
    {"mains": ["Aloo Tikki Burger"], "sides": ["Cheesy Fries"], "drink": "Coke", "weight": 8},
    {"mains": ["Mexican Aloo Tikki"], "sides": ["Regular Fries"], "drink": "Coke", "weight": 7},
    # pizza combos
    {"mains": ["Veg Loaded Pizza"], "sides": ["Regular Fries"], "drink": "Coke", "weight": 12},
    {"mains": ["Margherita Pizza"], "sides": ["Regular Fries"], "drink": "Coke", "weight": 14},
    {"mains": ["Veg Loaded Pizza"], "sides": ["Cheesy Fries"], "drink": "Strawberry Thick Shake", "weight": 6},
    {"mains": ["Margherita Pizza"], "sides": ["Cheesy Fries"], "drink": "Coke", "weight": 5},
    # double mains (sharing / family)
    {"mains": ["Aloo Tikki Burger", "Mexican Aloo Tikki"], "sides": ["Cheesy Fries"], "drink": "Coke", "weight": 4},
    {"mains": ["Veg Loaded Pizza", "Margherita Pizza"], "sides": ["Regular Fries"], "drink": "Strawberry Thick Shake", "weight": 3},
    # solo items
    {"mains": ["Aloo Tikki Burger"], "sides": [], "drink": None, "weight": 6},
    {"mains": ["Margherita Pizza"], "sides": [], "drink": None, "weight": 5},
    {"mains": ["Regular Fries"], "sides": [], "drink": "Coke", "weight": 4},
    {"mains": ["Cheesy Fries"], "sides": [], "drink": "Strawberry Thick Shake", "weight": 3},
    # drink only / snack
    {"mains": [], "sides": ["Regular Fries"], "drink": "Coke", "weight": 3},
    {"mains": [], "sides": ["Cheesy Fries"], "drink": "Coke", "weight": 2},
    {"mains": [], "sides": [], "drink": "Strawberry Thick Shake", "weight": 1},
]

CUSTOMER_FIRST = [
    "Rahul", "Priya", "Amit", "Sneha", "Vijay", "Anita",
    "Ravi", "Pooja", "Suresh", "Neha", "Rohan", "Meera",
    "Deepak", "Kavita", "Arjun", "Sonia", "Karan", "Nisha",
    "Manish", "Divya", "Sanjay", "Ankita", "Aakash", "Shreya",
    "Nikhil", "Swati", "Gaurav", "Ritika", "Harsh", "Jyoti",
    "Varun", "Pallavi", "Tushar", "Megha", "Rajesh", "Simran"
]
CUSTOMER_LAST = [
    "Sharma", "Patel", "Singh", "Gupta", "Kumar", "Joshi",
    "Verma", "Mehta", "Shah", "Reddy", "Desai", "Thakur",
    "Rawat", "Mishra", "Yadav", "Chauhan", "Malhotra", "Pandey"
]

TABLE_NUMBERS = [f"T{i}" for i in range(1, 16)]

SPECIAL_INSTRUCTIONS_ONLINE = [
    "Extra spicy please", "No onions", "Jain prep if possible", 
    "Please send cutlery", "Ring bell, do not knock", 
    "Keep it crispy", "Less ice in drinks", "Extra ketchup"
]

# ── HELPERS ─────────────────────────────────────────────────────

def weighted_choice(options):
    """Pick from [(value, weight), ...] by weight."""
    total = sum(w for _, w in options)
    r = random.uniform(0, total)
    cumulative = 0
    for value, weight in options:
        cumulative += weight
        if r <= cumulative:
            return value
    return options[-1][0]

def pick_hour():
    """Pick an hour based on HOUR_WEIGHTS."""
    hours = list(HOUR_WEIGHTS.keys())
    weights = list(HOUR_WEIGHTS.values())
    return random.choices(hours, weights=weights, k=1)[0]

def pick_combo():
    """Pick a combo template by weight."""
    weights = [c["weight"] for c in COMBO_TEMPLATES]
    return random.choices(COMBO_TEMPLATES, weights=weights, k=1)[0]

def random_phone():
    return f"+91 {random.randint(70000,99999)}{random.randint(10000,99999)}"


# ── MAIN ────────────────────────────────────────────────────────

def generate():
    db = SessionLocal()

    # Fetch restaurant + menu
    restaurants = db.query(Restaurant).all()
    restaurant = next((r for r in restaurants if db.query(MenuItem).filter(MenuItem.restaurant_id == str(r.id)).count() > 0), None)
    if not restaurant:
        print("❌ No restaurant found with menu items. Seed one first.")
        return
    rid = str(restaurant.id)

    menu_items = db.query(MenuItem).filter(MenuItem.restaurant_id == rid).all()
    item_map = {m.name: m for m in menu_items}
    print(f"🍽️  Restaurant: {restaurant.name}  |  Menu items: {len(menu_items)}")

    if not menu_items:
        print("❌ No menu items found. Add menu items first.")
        return

    # Delete old synthetic orders (orders in the past, not today)
    today = date.today()
    cutoff = datetime.combine(today, datetime.min.time())
    
    order_ids = db.query(Order.id).filter(
        Order.restaurant_id == rid,
        Order.created_at < cutoff
    ).all()
    
    if order_ids:
        ids_list = [row[0] for row in order_ids]
        print(f"🗑️  Removing {len(ids_list)} existing past orders...")
        # Chunking to avoid sqlite IN clause limit
        for i in range(0, len(ids_list), 500):
            chunk = ids_list[i:i+500]
            db.query(Payment).filter(Payment.order_id.in_(chunk)).delete(synchronize_session=False)
            db.query(KOT).filter(KOT.order_id.in_(chunk)).delete(synchronize_session=False)
            db.query(OrderItem).filter(OrderItem.order_id.in_(chunk)).delete(synchronize_session=False)
            db.query(Order).filter(Order.id.in_(chunk)).delete(synchronize_session=False)
        db.commit()

    order_counter = 0
    kot_counter = 0
    total_revenue = Decimal("0")

    start_date = today - timedelta(days=DAYS_BACK)

    for day_offset in range(DAYS_BACK):
        current_date = start_date + timedelta(days=day_offset)
        dow = current_date.weekday()  # 0=Mon ... 6=Sun
        is_weekend = dow >= 5

        # Monthly growth: slight increase over time
        growth = 1 + (day_offset / DAYS_BACK) * 0.15  # up to 15 % growth

        # Base order count
        base = random.randint(BASE_ORDERS_MIN, BASE_ORDERS_MAX)
        if is_weekend:
            base = int(base * WEEKEND_BOOST)
        n_orders = int(base * growth)

        # Add some daily noise
        n_orders = max(30, n_orders + random.randint(-8, 8))

        day_revenue = Decimal("0")

        for i in range(n_orders):
            order_counter += 1
            order_id = str(uuid.uuid4())

            # Time
            hour = pick_hour()
            minute = random.randint(0, 59)
            second = random.randint(0, 59)
            order_time = datetime(
                current_date.year, current_date.month, current_date.day,
                hour, minute, second
            )

            # Order type & source
            order_source = weighted_choice(ORDER_SOURCES)
            if order_source in (OrderSource.ZOMATO, OrderSource.SWIGGY):
                order_type = OrderType.DELIVERY  # Online = always delivery
            else:
                order_type = weighted_choice(ORDER_TYPES)

            # Customer
            table_num = random.choice(TABLE_NUMBERS) if order_type == OrderType.DINE_IN else None
            cust_name = f"{random.choice(CUSTOMER_FIRST)} {random.choice(CUSTOMER_LAST)}"
            special_instructions = random.choice(SPECIAL_INSTRUCTIONS_ONLINE) if random.random() < 0.3 else (f"[Eva Voice Order] Table {table_num}" if table_num else "")
            cust_phone = random_phone() if random.random() < 0.6 else None

            # Platform order ID for online orders
            platform_id = None
            if order_source == OrderSource.ZOMATO:
                platform_id = f"ZMT-{random.randint(100000, 999999)}"
            elif order_source == OrderSource.SWIGGY:
                platform_id = f"SWG-{random.randint(100000, 999999)}"

            # Status
            is_cancelled = random.random() < CANCEL_RATE
            status = OrderStatus.CANCELLED if is_cancelled else OrderStatus.COMPLETED
            completed_at = order_time + timedelta(minutes=random.randint(15, 45)) if not is_cancelled else None

            # Pick items (combo-based)
            combo = pick_combo()
            order_items_data = []

            for item_name in combo["mains"]:
                if item_name in item_map:
                    qty = random.choices([1, 2, 3], weights=[75, 20, 5], k=1)[0]
                    order_items_data.append((item_map[item_name], qty))

            for side_name in combo["sides"]:
                if side_name in item_map:
                    qty = random.choices([1, 2], weights=[80, 20], k=1)[0]
                    order_items_data.append((item_map[side_name], qty))

            if combo["drink"] and combo["drink"] in item_map:
                if random.random() < 0.75:  # 75% chance to add drink
                    qty = random.choices([1, 2, 3], weights=[70, 25, 5], k=1)[0]
                    order_items_data.append((item_map[combo["drink"]], qty))

            if not order_items_data:
                continue

            # Calculate totals
            subtotal = Decimal("0")
            for mi, qty in order_items_data:
                subtotal += Decimal(str(float(mi.price))) * qty

            gst = (subtotal * Decimal(str(GST_RATE))).quantize(Decimal("0.01"))

            # Discount
            discount = Decimal("0")
            if not is_cancelled and random.random() < DISCOUNT_RATE:
                disc_pct = random.randint(*DISCOUNT_RANGE)
                discount = (subtotal * Decimal(str(disc_pct / 100))).quantize(Decimal("0.01"))

            total = subtotal + gst - discount

            # Create Order
            order = Order(
                id=order_id,
                restaurant_id=rid,
                order_number=f"ORD-{current_date.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}-{i+1:04d}",
                order_type=order_type,
                order_source=order_source,
                status=status,
                table_number=table_num,
                platform_order_id=platform_id,
                customer_name=cust_name,
                customer_phone=cust_phone,
                subtotal=subtotal,
                gst_amount=gst,
                discount_amount=discount,
                total_amount=total,
                created_at=order_time,
                updated_at=completed_at or order_time,
                completed_at=completed_at
            )
            db.add(order)

            # Create OrderItems + KOTs
            for mi, qty in order_items_data:
                oi_id = str(uuid.uuid4())
                oi = OrderItem(
                    id=oi_id,
                    order_id=order_id,
                    menu_item_id=str(mi.id),
                    quantity=qty,
                    unit_price=mi.price,
                    item_status=status,
                    created_at=order_time,
                    updated_at=completed_at or order_time
                )
                db.add(oi)

                # KOT
                kot_counter += 1
                kot = KOT(
                    id=str(uuid.uuid4()),
                    order_id=order_id,
                    kot_number=f"KOT-{current_date.strftime('%Y%m%d')}-{kot_counter:05d}",
                    order_item_id=oi_id,
                    status=status,
                    started_at=order_time + timedelta(minutes=random.randint(1, 5)) if not is_cancelled else None,
                    completed_at=completed_at,
                    created_at=order_time
                )
                db.add(kot)

            # Create Payment (only for completed orders)
            if not is_cancelled:
                pay_mode = weighted_choice(PAYMENT_MODES)
                payment = Payment(
                    id=str(uuid.uuid4()),
                    order_id=order_id,
                    payment_mode=pay_mode,
                    amount=total,
                    transaction_id=f"TXN{uuid.uuid4().hex[:12].upper()}" if pay_mode != PaymentMode.CASH else None,
                    payment_status="completed",
                    created_at=completed_at or order_time
                )
                db.add(payment)
                day_revenue += total

            total_revenue += total if not is_cancelled else Decimal("0")

        # Commit each day's batch
        db.commit()

        day_str = current_date.strftime("%a %d-%b")
        wknd = " 🎉" if is_weekend else ""
        print(f"  {day_str}: {n_orders:3d} orders  |  ₹{day_revenue:>10,.2f}{wknd}")

    print(f"\n{'='*60}")
    print(f"✅ Generated {order_counter:,} orders over {DAYS_BACK} days")
    print(f"💰 Total revenue: ₹{total_revenue:,.2f}")
    print(f"🎫 KOT tickets: {kot_counter:,}")
    print(f"{'='*60}")

    # Now backfill daily summaries
    print("\n📊 Re-computing daily snapshots...")
    from services.snapshot_service import SnapshotService
    SnapshotService.backfill_missing_days(db, rid, lookback_days=DAYS_BACK + 1)
    print("✅ Daily snapshots updated!")

    db.close()
    print("\n🎉 Done! Your POS now has 3 months of realistic transaction history.")


if __name__ == "__main__":
    generate()
