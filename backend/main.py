from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import Base, engine, SessionLocal
from fastapi.staticfiles import StaticFiles
import os

# Import routes
from routes import auth, menu, inventory, orders, kds, billing, reports, ai
from routes import agents as agents_route
from routes.customer import router as customer_router, admin_router as table_admin_router
from routes.call_orders import router as call_orders_router
from routes.voice_bot import router as voice_bot_router
from routes.twilio_bot import router as twilio_bot_router
from routes.revenue_intelligence import router as revenue_intelligence_router

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Production-Grade Restaurant POS System API",
    version="1.0.0"
)

# Configure CORS - allow all origins for customer table devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create public directory if it doesn't exist
os.makedirs("public/images/menu_items", exist_ok=True)
os.makedirs("temp_audio", exist_ok=True)
os.makedirs("static/invoices", exist_ok=True)
os.makedirs("static/reports", exist_ok=True)

# Mount static files
app.mount("/public", StaticFiles(directory="public"), name="public")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(auth.router)
app.include_router(menu.router)
app.include_router(inventory.router)
app.include_router(orders.router)
app.include_router(kds.router)
app.include_router(billing.router)
app.include_router(reports.router)
app.include_router(ai.router)

# Optional Agents Route
try:
    app.include_router(agents_route.router)
except Exception as e:
    print(f"[WARN] Agents route disabled: {e}")
app.include_router(customer_router)
app.include_router(table_admin_router)
app.include_router(call_orders_router)
app.include_router(voice_bot_router)
app.include_router(twilio_bot_router)
app.include_router(revenue_intelligence_router)

# Scheduler for daily agent analysis
_scheduler = None

@app.on_event("startup")
async def startup_event():
    global _scheduler
    try:
        from services.scheduler import start_scheduler
        _scheduler = start_scheduler()
        print("[SCHEDULER] Daily Planning Scheduler started")
    except Exception as e:
        print(f"[WARN] Scheduler failed to start: {e}")
    
    # Load Whisper model for voice ordering
    try:
        from services.whisper_engine import whisper_engine
        whisper_engine.load_model()
        print("[WHISPER] Voice ordering model loaded successfully")
    except Exception as e:
        print(f"[WARN] Whisper model failed to load (voice ordering disabled): {e}")
    
    # Backfill daily summaries on startup
    try:
        from services.snapshot_service import SnapshotService
        from models import Restaurant
        db = SessionLocal()
        restaurants = db.query(Restaurant).all()
        for restaurant in restaurants:
            SnapshotService.backfill_missing_days(db, str(restaurant.id), lookback_days=30)
        db.close()
        print(f"[SNAPSHOT] Daily summaries backfilled for {len(restaurants)} restaurant(s)")
    except Exception as e:
        print(f"[WARN] Snapshot backfill failed: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    global _scheduler
    if _scheduler:
        from services.scheduler import stop_scheduler
        stop_scheduler(_scheduler)
        print("[SCHEDULER] Scheduler stopped")

@app.get("/")
def root():
    return {
        "message": "Restaurant POS System API",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
