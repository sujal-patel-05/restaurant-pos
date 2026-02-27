"""
Migration script to create voice ordering tables and add columns to orders.
Run: python migrate_voice_tables.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "restaurant_pos.db")


def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Create table_configs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS table_configs (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL,
            table_id TEXT UNIQUE NOT NULL,
            table_number TEXT NOT NULL,
            table_name TEXT,
            capacity INTEGER DEFAULT 4,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
        )
    """)
    print("[OK] table_configs table created")

    # 2. Create table_sessions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS table_sessions (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL,
            table_config_id TEXT,
            table_id TEXT NOT NULL,
            table_number TEXT NOT NULL,
            session_token TEXT,
            pax INTEGER DEFAULT 1,
            status TEXT DEFAULT 'active',
            session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            session_end TIMESTAMP,
            total_orders INTEGER DEFAULT 0,
            total_spent DECIMAL(10,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
            FOREIGN KEY (table_config_id) REFERENCES table_configs(id)
        )
    """)
    print("[OK] table_sessions table created")

    # 3. Create voice_order_logs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS voice_order_logs (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            table_id TEXT NOT NULL,
            audio_file_path TEXT,
            raw_transcript TEXT,
            parsed_json TEXT,
            matched_json TEXT,
            confidence_avg REAL DEFAULT 0.0,
            order_id TEXT,
            was_confirmed INTEGER DEFAULT 0,
            was_edited INTEGER DEFAULT 0,
            whisper_model TEXT DEFAULT 'base',
            processing_time_ms INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES table_sessions(id),
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )
    """)
    print("[OK] voice_order_logs table created")

    # 4. Add session_id and voice_log_id columns to orders
    existing = [row[1] for row in cursor.execute("PRAGMA table_info(orders)").fetchall()]

    if "session_id" not in existing:
        cursor.execute("ALTER TABLE orders ADD COLUMN session_id TEXT REFERENCES table_sessions(id)")
        print("[OK] Added session_id column to orders")
    else:
        print("[SKIP] session_id already exists in orders")

    if "voice_log_id" not in existing:
        cursor.execute("ALTER TABLE orders ADD COLUMN voice_log_id TEXT REFERENCES voice_order_logs(id)")
        print("[OK] Added voice_log_id column to orders")
    else:
        print("[SKIP] voice_log_id already exists in orders")

    conn.commit()
    conn.close()
    print("\n[DONE] Voice ordering migration complete!")


if __name__ == "__main__":
    migrate()
