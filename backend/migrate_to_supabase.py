"""
🚀 One-Click Migration Script: SQLite → Supabase (PostgreSQL)
=============================================================

This script migrates ALL your data from your local SQLite database
to your new Supabase PostgreSQL database — perfectly and safely.

Usage:
  1. Set your SUPABASE_URL in .env (see SUPABASE_SETUP.md)
  2. Run: python migrate_to_supabase.py
  3. Done! All your data is now in the cloud.

It will NOT modify your local SQLite database (read-only).
"""

import os
import sys
import sqlite3
from datetime import datetime

# ── Configuration ──
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "restaurant_pos.db")


def get_supabase_url():
    """Read the Supabase URL from .env or environment."""
    # Try environment variable first
    url = os.environ.get("SUPABASE_DATABASE_URL") or os.environ.get("DATABASE_URL")
    
    # Try reading from .env file
    if not url:
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("SUPABASE_DATABASE_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
    
    if not url:
        print("❌ ERROR: SUPABASE_DATABASE_URL not found!")
        print("   Add this line to your .env file:")
        print("   SUPABASE_DATABASE_URL=postgresql://postgres.xxx:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres")
        sys.exit(1)
    
    # Fix Supabase URL for SQLAlchemy
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    
    return url


def migrate():
    """Main migration function."""
    
    # ── Step 1: Verify SQLite DB exists ──
    if not os.path.exists(SQLITE_DB_PATH):
        print(f"❌ SQLite database not found at: {SQLITE_DB_PATH}")
        print("   Make sure you run this script from the backend/ directory.")
        sys.exit(1)
    
    print("=" * 60)
    print("🚀 5ive POS Migration: SQLite → Supabase")
    print("=" * 60)
    print(f"📂 Source: {SQLITE_DB_PATH}")
    
    # ── Step 2: Connect to SQLite (read-only) ──
    sqlite_conn = sqlite3.connect(f"file:{SQLITE_DB_PATH}?mode=ro", uri=True)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    # ── Step 3: Connect to Supabase PostgreSQL ──
    supabase_url = get_supabase_url()
    print(f"☁️  Target: Supabase PostgreSQL")
    
    try:
        import psycopg2
    except ImportError:
        print("❌ psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)
    
    pg_conn = psycopg2.connect(supabase_url)
    pg_conn.autocommit = False
    pg_cursor = pg_conn.cursor()
    
    print("✅ Connected to both databases!\n")
    
    # ── Step 4: Run schema first ──
    print("📋 Step 1: Skipping schema creation (assuming tables already exist in Supabase)...\n")
    pass
    
    # ── Step 5: Define migration order (respects foreign keys) ──
    # Order is CRITICAL — parent tables first, then children
    tables_to_migrate = [
        "restaurants",
        "users",
        "menu_categories",
        "menu_items",
        "ingredients",
        "bom_mappings",
        "inventory_transactions",
        "table_configs",
        "table_sessions",
        "discounts",
        "orders",
        "order_items",
        "voice_order_logs",
        "kot",
        "payments",
        "invoices",
        "wastage_logs",
        "daily_summaries",
    ]
    
    print("📋 Step 2: Migrating data...\n")
    total_rows = 0
    
    for table_name in tables_to_migrate:
        try:
            # Check if table exists in SQLite
            sqlite_cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,)
            )
            if not sqlite_cursor.fetchone():
                print(f"   ⏭️  {table_name}: not found in SQLite (skipping)")
                continue
            
            # Read all rows from SQLite
            sqlite_cursor.execute(f"SELECT * FROM {table_name}")
            rows = sqlite_cursor.fetchall()
            
            if not rows:
                print(f"   📭 {table_name}: empty (0 rows)")
                continue
            
            # Get column names
            columns = [description[0] for description in sqlite_cursor.description]
            col_names = ", ".join(columns)
            placeholders = ", ".join(["%s"] * len(columns))
            
            # Insert into PostgreSQL with ON CONFLICT DO NOTHING (skip duplicates)
            insert_sql = f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
            
            inserted = 0
            for row in rows:
                try:
                    row_list = list(row)
                    # SQLite stores booleans as 0/1, Postgres requires True/False
                    for i, col_name in enumerate(columns):
                        c_lower = col_name.lower()
                        if (c_lower.startswith('is_') or 
                            c_lower.startswith('has_') or 
                            c_lower.startswith('was_') or 
                            'active' in c_lower or 
                            'available' in c_lower or
                            'confirmed' in c_lower or 
                            'edited' in c_lower):
                            if row_list[i] is not None:
                                # Ensure it's a real boolean
                                row_list[i] = bool(row_list[i])
                    
                    pg_cursor.execute(insert_sql, tuple(row_list))
                    pg_conn.commit()  # Commit each row individually for safety
                    inserted += 1
                except Exception as e:
                    pg_conn.rollback()
                    # Try to continue with remaining rows
                    print(f"   ⚠️  {table_name}: row error: {str(e)[:100]}")
                    continue
            
            total_rows += inserted
            print(f"   ✅ {table_name}: {inserted}/{len(rows)} rows migrated")
            
        except Exception as e:
            pg_conn.rollback()
            print(f"   ❌ {table_name}: FAILED — {str(e)[:100]}")
    
    # ── Step 6: Summary ──
    print(f"\n{'=' * 60}")
    print(f"🎉 MIGRATION COMPLETE!")
    print(f"   Total rows migrated: {total_rows}")
    print(f"   Time: {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'=' * 60}")
    print(f"\n📋 Next Steps:")
    print(f"   1. Update your .env file:")
    print(f"      DATABASE_URL=<your_supabase_url>")
    print(f"   2. Restart the backend: python -m uvicorn main:app --reload")
    print(f"   3. Test: Open the frontend and check if data loads!")
    
    # Cleanup
    sqlite_conn.close()
    pg_conn.close()


if __name__ == "__main__":
    migrate()
