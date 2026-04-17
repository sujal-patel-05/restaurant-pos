import sqlite3

conn = sqlite3.connect('restaurant_pos.db')
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in c.fetchall()]
print(f"Tables: {tables}")

if 'orders' in tables:
    c.execute("SELECT COUNT(*) FROM orders")
    print(f"Orders: {c.fetchone()[0]}")

if 'restaurants' in tables:
    c.execute("SELECT COUNT(*) FROM restaurants")
    print(f"Restaurants: {c.fetchone()[0]}")

conn.close()
