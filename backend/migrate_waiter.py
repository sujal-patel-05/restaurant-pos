"""Add waiter_name column to orders table"""
import sqlite3

conn = sqlite3.connect('restaurant_pos.db')
c = conn.cursor()

cols = [row[1] for row in c.execute('PRAGMA table_info(orders)').fetchall()]

if 'waiter_name' not in cols:
    c.execute('ALTER TABLE orders ADD COLUMN waiter_name VARCHAR(255)')
    print('✅ Added column: waiter_name')
else:
    print('⏭️  Column already exists: waiter_name')

conn.commit()
conn.close()
print('✅ Migration done!')
