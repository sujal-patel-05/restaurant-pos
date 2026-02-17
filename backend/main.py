from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import Base, engine
from fastapi.staticfiles import StaticFiles
import os

# Import routes
from routes import auth, menu, inventory, orders, kds, billing, reports, ai
from routes import agents as agents_route

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Production-Grade Restaurant POS System API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create public directory if it doesn't exist
os.makedirs("public/images/menu_items", exist_ok=True)

# Mount static files
app.mount("/public", StaticFiles(directory="public"), name="public")

# Include routers
app.include_router(auth.router)
app.include_router(menu.router)
app.include_router(inventory.router)
app.include_router(orders.router)
app.include_router(kds.router)
app.include_router(billing.router)
app.include_router(reports.router)
app.include_router(ai.router)
app.include_router(agents_route.router)

# Scheduler for daily agent analysis
_scheduler = None

@app.on_event("startup")
async def startup_event():
    global _scheduler
    try:
        from services.scheduler import start_scheduler
        _scheduler = start_scheduler()
        print("⏰ Daily Planning Scheduler started")
    except Exception as e:
        print(f"⚠️ Scheduler failed to start: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    global _scheduler
    if _scheduler:
        from services.scheduler import stop_scheduler
        stop_scheduler(_scheduler)
        print("⏰ Scheduler stopped")

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
