"""Add new columns to existing orders table for online order support"""
import sqlite3

conn = sqlite3.connect('restaurant_pos.db')
c = conn.cursor()

# Get existing columns
cols = [row[1] for row in c.execute('PRAGMA table_info(orders)').fetchall()]
print(f"Existing columns: {cols}")

new_cols = [
    ('order_source', 'VARCHAR(10) DEFAULT "pos"'),
    ('delivery_address', 'VARCHAR(500)'),
    ('platform_order_id', 'VARCHAR(100)'),
    ('rejection_reason', 'VARCHAR(255)'),
]

for col_name, col_type in new_cols:
    if col_name not in cols:
        c.execute(f'ALTER TABLE orders ADD COLUMN {col_name} {col_type}')
        print(f'  ✅ Added column: {col_name}')
    else:
        print(f'  ⏭️  Column already exists: {col_name}')

conn.commit()
conn.close()
print('\n✅ Migration done!')
