import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from database import SessionLocal
from models import Restaurant, MenuItem
db = SessionLocal()
restaurant = db.query(Restaurant).first()
if restaurant:
    print(f"Restaurant Name: {restaurant.name}")
else:
    print("No restaurant found")

item = db.query(MenuItem).first()
if item:
    print(f"First menu item: {item.name} for restaurant {item.restaurant.name}")
