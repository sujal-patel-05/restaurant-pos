from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# ── Fix Supabase URL ──
# Supabase gives you: postgres://user:pass@host:port/db
# SQLAlchemy requires:  postgresql://user:pass@host:port/db
database_url = settings.DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# ── Engine Configuration ──
connect_args = {}
engine_kwargs = {}

if database_url.startswith("sqlite"):
    # SQLite specific: allow same thread for FastAPI
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL (Supabase) — use connection pooling for production
    engine_kwargs = {
        "pool_size": 5,          # Keep 5 connections open
        "max_overflow": 10,      # Allow 10 extra connections under load
        "pool_timeout": 30,      # Wait up to 30s for a free connection
        "pool_recycle": 1800,    # Recycle connections every 30 min (prevents stale connections)
        "pool_pre_ping": True,   # Test connections before using them (important for Supabase)
    }

engine = create_engine(
    database_url,
    connect_args=connect_args,
    **engine_kwargs
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
