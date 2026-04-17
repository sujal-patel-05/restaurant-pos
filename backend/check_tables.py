import sqlite3
import os

db_path = 'restaurant_pos.db'

if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Total tables: {len(tables)}")
        print("Table names:")
        for table in tables:
            print(f"- {table[0]}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
