import sqlite3
from datetime import datetime, timedelta
import os

# Connect to the database
db_path = "restaurant_pos.db"
if not os.path.exists(db_path):
    print(f"❌ Database not found at {db_path}")
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print(f"📅 Current System Time: {datetime.now()}")

today_str = datetime.now().strftime("%Y-%m-%d")

# 1. Check Orders for Today
print("\n🔍 Checking Orders (created_at)...")
cursor.execute("SELECT id, total_amount, status, created_at FROM orders WHERE created_at LIKE ? ORDER BY created_at DESC", (f"{today_str}%",))
orders = cursor.fetchall()

total_sales_value = 0
if not orders:
    print("   No orders found.")
else:
    for o in orders:
        print(f"   Order ID: {o[0]}, Total: ₹{o[1]}, Status: {o[2]}, Created: {o[3]}")
        total_sales_value += o[1]

print(f"\n📈 Total Order Value (Sales) for {today_str}: ₹{total_sales_value}")

# Inspect Schema first
print("\n📝 Inspecting 'payments' table schema:")
cursor.execute("PRAGMA table_info(payments)")
columns = cursor.fetchall()
for col in columns:
    print(col)

# 2. Check Payments for Today
print("\n💰 Checking Payments...")
cursor.execute("SELECT id, order_id, amount, payment_mode, created_at FROM payments ORDER BY created_at DESC LIMIT 20")
payments = cursor.fetchall()

total_revenue_today = 0
today_str = datetime.now().strftime("%Y-%m-%d")

if not payments:
    print("   No payments found.")
else:
    for p in payments:
        print(f"   Payment ID: {p[0]}, Amount: ₹{p[2]}, Mode: {p[3]}, Date: {p[4]}")
        # Simple string check for today
        if str(p[4]).startswith(today_str):
             total_revenue_today += p[2]

print(f"\n📊 Calculated Total Revenue for {today_str}: ₹{total_revenue_today}")

conn.close()
