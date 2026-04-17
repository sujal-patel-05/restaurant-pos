import os
import random
import uuid
from datetime import datetime, timedelta
import sys

# Ensure backend folder is in path so we can import from database and models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.menu import MenuItem
from models.order import Order, OrderItem, OrderStatus, OrderType, OrderSource
from models.billing import Payment, PaymentMode
from models.restaurant import Restaurant

def seed_sales_data():
    db = SessionLocal()
    try:
        # Get the first restaurant
        restaurant = db.query(Restaurant).first()
        if not restaurant:
            print("❌ No restaurant found. Create a restaurant first.")
            return

        print(f"🏢 Generating sales for Restaurant: {restaurant.name}")

        # Get existing menu items
        menu_items = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant.id).all()
        if not menu_items:
            print("⚠️ No menu items found. Creating initial menu items...")
            from models.menu import MenuCategory

            categories_data = ["Fast Food", "Beverages", "Desserts", "South Indian"]
            cat_map = {}
            for c_name in categories_data:
                cat = MenuCategory(restaurant_id=restaurant.id, name=c_name, is_active=True)
                db.add(cat)
                db.commit()
                db.refresh(cat)
                cat_map[c_name] = cat.id

            items_to_add = [
                ("Burger", 150, "Fast Food"), ("Pizza", 350, "Fast Food"), ("Fries", 100, "Fast Food"),
                ("Cold Coffee", 120, "Beverages"), ("Masala Chai", 40, "Beverages"),
                ("Brownie", 180, "Desserts"), ("Ice Cream", 90, "Desserts"),
                ("Masala Dosa", 120, "South Indian"), ("Idli", 60, "South Indian")
            ]
            for (name, price, c_name) in items_to_add:
                item = MenuItem(
                    restaurant_id=restaurant.id,
                    name=name,
                    price=price,
                    category_id=cat_map[c_name],
                    is_available=True,
                    preparation_time=15
                )
                db.add(item)
            
            db.commit()
            menu_items = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant.id).all()
            print(f"🍔 Created {len(menu_items)} default menu items.")

        print(f"🍔 Found {len(menu_items)} menu items. Generating 6 months of historical orders...")

        # Setup timeline: 180 days ago to today
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=180)
        
        # Payment mode weights
        payment_modes = [PaymentMode.UPI, PaymentMode.UPI, PaymentMode.CASH, PaymentMode.CARD]
        order_types = [OrderType.DINE_IN, OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY]
        order_sources = [OrderSource.POS, OrderSource.ZOMATO, OrderSource.SWIGGY, OrderSource.WAITER]

        total_orders_created = 0
        current_date = start_date

        while current_date <= end_date:
            # More orders on weekends (Friday=4, Saturday=5, Sunday=6)
            is_weekend = current_date.weekday() >= 4
            num_orders = random.randint(35, 60) if is_weekend else random.randint(15, 30)

            # Generate orders for the day
            orders_to_add = []
            
            for _ in range(num_orders):
                # Randomize time during the day (mostly between 12 PM - 3 PM and 7 PM - 10 PM)
                if random.random() < 0.4:
                    # Lunch rush
                    hour = random.randint(12, 15)
                elif random.random() < 0.8:
                    # Dinner rush
                    hour = random.randint(19, 22)
                else:
                    # Off-peak
                    hour = random.choice([11, 16, 17, 18, 23])
                    
                minute = random.randint(0, 59)
                second = random.randint(0, 59)
                order_time = current_date.replace(hour=hour, minute=minute, second=second)

                # Order basics
                order_id = str(uuid.uuid4())
                order_number = f"ORD-{order_time.strftime('%m%d%H%M')}-{random.randint(100, 999)}"
                o_type = random.choice(order_types)
                
                # Assign source
                o_source = OrderSource.POS
                if o_type == OrderType.DELIVERY:
                    o_source = random.choice([OrderSource.ZOMATO, OrderSource.SWIGGY])
                elif o_type == OrderType.DINE_IN:
                    o_source = random.choice([OrderSource.POS, OrderSource.WAITER])
                    
                # Pick 1-4 random menu items
                num_items = random.choices([1, 2, 3, 4, 5], weights=[0.2, 0.4, 0.25, 0.1, 0.05])[0]
                selected_items = random.sample(menu_items, min(num_items, len(menu_items)))
                
                subtotal = 0
                order_items_to_add = []
                
                for item in selected_items:
                    qty = random.choices([1, 2, 3], weights=[0.7, 0.2, 0.1])[0]
                    line_price = float(item.price) * qty
                    subtotal += line_price
                    
                    order_items_to_add.append(
                        OrderItem(
                            id=str(uuid.uuid4()),
                            order_id=order_id,
                            menu_item_id=item.id,
                            quantity=qty,
                            unit_price=item.price,
                            item_status=OrderStatus.COMPLETED,
                            created_at=order_time,
                            updated_at=order_time
                        )
                    )
                
                # Tax calculation (e.g. 5% GST)
                gst_amount = subtotal * 0.05
                total_amount = subtotal + gst_amount
                
                # Create Order
                new_order = Order(
                    id=order_id,
                    restaurant_id=restaurant.id,
                    order_number=order_number,
                    order_type=o_type,
                    order_source=o_source,
                    status=OrderStatus.COMPLETED,
                    table_number=f"T{random.randint(1, 15)}" if o_type == OrderType.DINE_IN else None,
                    subtotal=subtotal,
                    gst_amount=gst_amount,
                    total_amount=total_amount,
                    created_at=order_time,
                    updated_at=order_time,
                    completed_at=order_time + timedelta(minutes=random.randint(15, 45))
                )
                
                # Create Payment
                new_payment = Payment(
                    id=str(uuid.uuid4()),
                    order_id=order_id,
                    payment_mode=random.choice(payment_modes),
                    amount=total_amount,
                    payment_status="completed",
                    created_at=order_time
                )

                db.add(new_order)
                for oi in order_items_to_add:
                    db.add(oi)
                db.add(new_payment)
                
                total_orders_created += 1

            # Commit batch per day
            db.commit()
            
            # Print progress slightly
            if current_date.day == 1:
                print(f"✅ Generated for month: {current_date.strftime('%B %Y')}")

            # Advance 1 day
            current_date += timedelta(days=1)

        print(f"\n🎉 Successfully generated {total_orders_created} historical orders over 6 months!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding sales: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting sales data generation process...")
    seed_sales_data()
