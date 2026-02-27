"""Fix existing orders that have NULL order_source"""
import sqlite3

conn = sqlite3.connect('restaurant_pos.db')
c = conn.cursor()

# Update NULL order_source to 'pos'
c.execute("UPDATE orders SET order_source = 'POS' WHERE order_source IS NULL OR order_source = 'pos'")
updated = c.rowcount
print(f"Updated {updated} orders with NULL/lowercase order_source -> POS")

conn.commit()
conn.close()
print("Done!")
