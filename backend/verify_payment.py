
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Order, OrderItem, MenuItem, User, Restaurant
from models.billing import Payment, PaymentMode
from services.order_service import OrderService
from database import Base
import uuid

# Setup DB connection
SQLALCHEMY_DATABASE_URL = "sqlite:///./restaurant_pos.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def verify_payment_integration():
    print("Verifying Payment Integration...")
    
    # 1. Get a user and restaurant
    user = db.query(User).first()
    restaurant = db.query(Restaurant).first()
    
    if not user or not restaurant:
        print("Error: No user or restaurant found. Please init db first.")
        return

    # 2. Get a menu item
    menu_item = db.query(MenuItem).first()
    if not menu_item:
        print("Error: No menu items found.")
        return

    print(f"Using User: {user.username}, Restaurant: {restaurant.name}, Item: {menu_item.name}")

    # 3. Create an order payload with payment_mode
    order_data = {
        "order_type": "dine_in",
        "table_number": "T-99",
        "payment_mode": "upi", # TESTING UPI
        "amount_paid": 0, # Should verify this gets set to total
        "items": [
            {
                "menu_item_id": str(menu_item.id),
                "quantity": 1
            }
        ]
    }

    print(f"Attempting to create order with payment_mode='upi'...")
    
    try:
        result = OrderService.create_order(
            db,
            user.restaurant_id,
            order_data,
            user.id
        )
        
        if not result.get("success"):
            print(f"Failed to create order: {result.get('error')}")
            return

        order_id = result.get("order_id")
        print(f"Order created successfully: {order_id}")
        
        # 4. Verify Payment Record
        payment = db.query(Payment).filter(Payment.order_id == order_id).first()
        
        if payment:
            print("SUCCESS: Payment record found!")
            print(f"  - Payment ID: {payment.id}")
            print(f"  - Mode: {payment.payment_mode}")
            print(f"  - Amount: {payment.amount}")
            print(f"  - Status: {payment.payment_status}")
            
            if payment.payment_mode == PaymentMode.UPI:
                print("  - Mode matches 'upi'")
            else:
                print(f"  - Mode ERROR: expected 'upi', got {payment.payment_mode}")
                
        else:
            print("FAILURE: No payment record created for this order.")

    except Exception as e:
        print(f"Exception during verification: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_payment_integration()
