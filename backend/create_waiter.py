"""
Create sample waiter accounts for the Waiter Interface
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from models import User, Restaurant, UserRole
from utils.auth import hash_password

WAITERS = [
    {"username": "waiter1", "full_name": "Rahul Sharma", "email": "rahul@restaurant.com", "password": "waiter123"},
    {"username": "waiter2", "full_name": "Priya Patel", "email": "priya@restaurant.com", "password": "waiter123"},
]

def create_waiters():
    db = SessionLocal()
    restaurant = db.query(Restaurant).first()
    if not restaurant:
        print("[ERROR] No restaurant found. Create one first.")
        return

    print(f"Restaurant: {restaurant.name}")
    
    for w in WAITERS:
        existing = db.query(User).filter(User.username == w["username"]).first()
        if existing:
            print(f"  [SKIP] {w['username']} already exists")
            continue
        
        user = User(
            restaurant_id=str(restaurant.id),
            username=w["username"],
            email=w["email"],
            password_hash=hash_password(w["password"]),
            full_name=w["full_name"],
            role=UserRole.WAITER,
            is_active=True,
        )
        db.add(user)
        print(f"  [OK] Created waiter: {w['username']} / {w['password']} ({w['full_name']})")
    
    db.commit()
    db.close()
    print("\nWaiter accounts ready!")
    print("Login at: http://localhost:5173/waiter/login")

if __name__ == "__main__":
    create_waiters()
