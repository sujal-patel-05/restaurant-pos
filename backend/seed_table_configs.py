"""
Seed table configurations (T1-T15) for the voice ordering system.
Run: python seed_table_configs.py
"""
import sqlite3
import os
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), "restaurant_pos.db")


def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get first restaurant
    row = cursor.execute("SELECT id FROM restaurants LIMIT 1").fetchone()
    if not row:
        print("[ERROR] No restaurant found. Create one first.")
        conn.close()
        return

    restaurant_id = row[0]

    tables = [
        ("T1", "1", "Table 1", 4),
        ("T2", "2", "Table 2", 4),
        ("T3", "3", "Table 3", 2),
        ("T4", "4", "Table 4", 6),
        ("T5", "5", "Table 5", 4),
        ("T6", "6", "Window Seat", 2),
        ("T7", "7", "Table 7", 4),
        ("T8", "8", "Table 8", 4),
        ("T9", "9", "Family Table", 8),
        ("T10", "10", "Table 10", 4),
        ("T11", "11", "Table 11", 2),
        ("T12", "12", "Booth 1", 4),
        ("T13", "13", "Booth 2", 4),
        ("T14", "14", "VIP Table", 6),
        ("T15", "15", "Bar Counter", 2),
    ]

    inserted = 0
    for table_id, number, name, capacity in tables:
        exists = cursor.execute("SELECT 1 FROM table_configs WHERE table_id = ?", (table_id,)).fetchone()
        if not exists:
            cursor.execute(
                "INSERT INTO table_configs (id, restaurant_id, table_id, table_number, table_name, capacity) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), restaurant_id, table_id, number, name, capacity)
            )
            inserted += 1

    conn.commit()
    conn.close()
    print(f"[DONE] Seeded {inserted} table configs (skipped {len(tables) - inserted} existing)")


if __name__ == "__main__":
    seed()
