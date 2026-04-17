"""
MSc Data Science Standard Data Simulation Script
Generates 90 days of realistic restaurant data with:
1. Base algebraic trend (growth over time)
2. Multiplicative weekly seasonality (weekend spikes)
3. Normal distribution noise (realistic variance)
4. Pareto distribution for menu item sales (80/20 rule)
"""
import os
import sys
import math
import random
from datetime import datetime, timedelta
from decimal import Decimal

# Add backend directory to path and load env
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from database import SessionLocal
from models import Restaurant, Order, OrderItem, MenuItem, OrderStatus, OrderSource, KOT, Payment
from models.billing import PaymentMode
from utils.helpers import generate_order_number

def seed_90_days_data():
    db = SessionLocal()
    try:
        rests = db.query(Restaurant).all()
        restaurant = None
        for r in rests:
            if db.query(MenuItem).filter(MenuItem.restaurant_id == str(r.id)).count() > 0:
                restaurant = r
                break
                
        if not restaurant:
            print("[ERROR] No restaurant with menu items found in DB. Cannot continue.")
            return

        rid = str(restaurant.id)
        menu_items = db.query(MenuItem).filter(MenuItem.restaurant_id == rid, MenuItem.is_available == True).all()
        if not menu_items:
            print("[ERROR] No menu items found. Please add menu items first.")
            return

        print(f"[OK] Found Restaurant: {restaurant.name}")
        print(f"[OK] Generative baseline starting...")

        # Setup parameters
        base_daily_orders = 40  # Base orders on a Tuesday
        growth_rate = 0.005     # 0.5% daily growth rate
        noise_std_dev = 0.15    # 15% random noise

        # Weekly Seasonality Multipliers (Multiplicative Seasonality)
        # 1.0 = Baseline (Tuesday)
        seasonality = {
            0: 0.9,   # Monday (Slowest)
            1: 1.0,   # Tuesday (Baseline)
            2: 1.1,   # Wednesday
            3: 1.2,   # Thursday
            4: 1.6,   # Friday (Busy)
            5: 2.1,   # Saturday (Peak)
            6: 1.9    # Sunday (Peak)
        }

        # Clear existing old data
        today = datetime.utcnow().date()
        start_date = today - timedelta(days=90)
        
        print(f"[*] Bulk cleaning up erratic historical orders since {start_date}...")
        
        # Fast bulk deletion
        order_ids_query = db.query(Order.id).filter(
            Order.restaurant_id == rid,
            Order.created_at >= datetime.combine(start_date, datetime.min.time())
        )
        
        # Delete children first
        db.query(Payment).filter(Payment.order_id.in_(order_ids_query)).delete(synchronize_session=False)
        db.query(KOT).filter(KOT.order_id.in_(order_ids_query)).delete(synchronize_session=False)
        db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids_query)).delete(synchronize_session=False)
        
        # Delete parent orders
        db.query(Order).filter(Order.id.in_(order_ids_query)).delete(synchronize_session=False)
        db.commit()
        print("[OK] Cleanup complete.")

        total_simulated_orders = 0
        total_simulated_revenue = Decimal(0)

        print("\n[*] Simulating 90 days of MSc-Grade Stochastic Demand...")
        for day_offset in range(90):
            current_date = start_date + timedelta(days=day_offset)
            weekday = current_date.weekday()
            
            trend = math.exp(growth_rate * day_offset)
            seasonal_multiplier = seasonality[weekday]
            noise = random.gauss(0, noise_std_dev)
            stochastic_multiplier = max(0.5, 1.0 + noise)
            
            expected_orders = int(base_daily_orders * trend * seasonal_multiplier * stochastic_multiplier)
            
            if expected_orders <= 0:
                continue

            daily_revenue = Decimal(0)
            
            for _ in range(expected_orders):
                hour = random.choices(
                    list(range(11, 23)), 
                    weights=[1, 2, 4, 3, 2, 2, 2, 5, 8, 7, 3, 1]
                )[0]
                minute = random.randint(0, 59)
                second = random.randint(0, 59)
                order_time = datetime.combine(current_date, datetime.min.time()).replace(hour=hour, minute=minute, second=second)

                source = random.choices([OrderSource.ZOMATO, OrderSource.SWIGGY, OrderSource.POS], weights=[60, 20, 20])[0]

                order = Order(
                    restaurant_id=rid,
                    order_number=generate_order_number(rid),
                    order_source=source,
                    status=OrderStatus.COMPLETED,
                    created_at=order_time,
                    updated_at=order_time,
                    customer_name="Simulated Customer"
                )
                db.add(order)
                db.flush()

                weights = [math.exp(-idx * 0.5) for idx in range(len(menu_items))]
                num_items = random.choices([1, 2, 3, 4, 5], weights=[30, 40, 20, 8, 2])[0]
                selected_items = random.choices(menu_items, weights=weights, k=num_items)

                subtotal = Decimal(0)
                for item in selected_items:
                    qty = random.choices([1, 2, 3], weights=[70, 20, 10])[0]
                    oi = OrderItem(
                        order_id=order.id,
                        menu_item_id=item.id,
                        quantity=qty,
                        unit_price=item.price,
                        item_status=OrderStatus.COMPLETED
                    )
                    db.add(oi)
                    subtotal += (item.price * qty)

                order.subtotal = subtotal
                order.gst_amount = (subtotal * Decimal(5)) / 100
                order.total_amount = order.subtotal + order.gst_amount
                
                pay = Payment(
                    order_id=order.id,
                    payment_mode=PaymentMode.UPI,
                    amount=order.total_amount,
                    payment_status="completed",
                    created_at=order_time
                )
                db.add(pay)

                daily_revenue += order.total_amount
                total_simulated_orders += 1

            db.commit()
            
            if day_offset % 10 == 0:
                print(f"   [Day {day_offset:02d}] {current_date.strftime('%Y-%m-%d')} | Orders: {expected_orders:03d} | Revenue: Rs {daily_revenue:,.2f}")

        print("\n[SUCCESS] Data Simulation Complete!")
        print(f"Total Orders Generated: {total_simulated_orders}")
        print(f"Total Revenue Generated: Rs {total_simulated_revenue:,.2f}")

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"[ERROR] details: {str(e)}")
    finally:
        db.close()

if __name__ == '__main__':
    seed_90_days_data()
