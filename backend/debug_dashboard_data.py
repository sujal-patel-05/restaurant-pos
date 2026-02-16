from database import SessionLocal
from models import Order, Restaurant, User
from datetime import datetime, timedelta

def debug_dashboard():
    db = SessionLocal()
    try:
        print("=== RESTAURANTS ===")
        restaurants = db.query(Restaurant).all()
        for r in restaurants:
            print(f"ID: {r.id}, Name: {r.name}")

        print("\n=== USERS ===")
        users = db.query(User).all()
        for u in users:
            print(f"ID: {u.id}, Name: {u.full_name}, Restaurant ID: {u.restaurant_id}")

        print("\n=== ORDERS (Today) ===")
        today = datetime.utcnow().date()
        today_start = datetime.combine(today, datetime.min.time())
        
        orders = db.query(Order).filter(Order.created_at >= today_start).all()
        print(f"Found {len(orders)} orders created since {today_start} UTC")
        
        total_amount = sum(o.total_amount for o in orders)
        print(f"\nSUMMARY: Found {len(orders)} orders. Total Amount: {total_amount}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_dashboard()
