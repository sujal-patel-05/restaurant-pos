"""
Database initialization script for SQLite
Run this to create all tables automatically
"""
from database import Base, engine
from models import *  # Import all models

def init_database():
    """Create all tables in the database"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")
    print(f"Database file: restaurant_pos.db")

if __name__ == "__main__":
    init_database()
