"""
APScheduler Service for SujalPOS
- Daily agent analysis at 8 AM IST
- Simulated online orders every 3-7 minutes
"""

import os
import logging
import random
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Store last run results in memory (also persisted via API)
_last_analysis_result = None
_last_run_time = None


def get_last_analysis():
    """Get the most recent analysis result"""
    return {
        "result": _last_analysis_result,
        "run_at": _last_run_time.isoformat() if _last_run_time else None
    }


def daily_planning_job():
    """
    The scheduled job that runs the CrewAI agents and sends the daily brief email.
    """
    global _last_analysis_result, _last_run_time
    
    logger.info("=" * 60)
    logger.info("🤖 DAILY PLANNING JOB STARTED")
    logger.info(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)
    
    try:
        # Run the multi-agent analysis
        from agents.crew_config import run_analysis
        result = run_analysis()
        
        _last_analysis_result = result
        _last_run_time = datetime.now()
        
        if result.get("success"):
            logger.info("✅ Agent analysis completed successfully")
            
            # Send email to restaurant owner
            owner_email = os.getenv("OWNER_EMAIL")
            if owner_email:
                try:
                    from services.email_service import EmailService
                    brief = result.get("daily_brief", "No brief generated.")
                    EmailService.send_daily_brief(
                        to_email=owner_email,
                        brief_content=brief,
                        date=datetime.now().strftime("%B %d, %Y"),
                        task_outputs=result.get("task_outputs", [])
                    )
                    logger.info(f"📧 Daily brief emailed to {owner_email}")
                except Exception as e:
                    logger.error(f"❌ Failed to send email: {e}")
            else:
                logger.warning("⚠️ OWNER_EMAIL not configured. Skipping email.")
        else:
            logger.error(f"❌ Agent analysis failed: {result.get('error')}")
            
    except Exception as e:
        logger.error(f"❌ Daily planning job crashed: {e}")
        import traceback
        logger.error(traceback.format_exc())


def online_order_job():
    """
    Generate a simulated Zomato/Swiggy order.
    Runs every 3-7 minutes (randomized interval for realism).
    """
    try:
        from database import SessionLocal
        from models import Restaurant
        from services.online_order_service import OnlineOrderService

        db = SessionLocal()
        try:
            # Get first restaurant
            restaurant = db.query(Restaurant).first()
            if not restaurant:
                return

            result = OnlineOrderService.generate_online_order(db, str(restaurant.id))
            if result:
                src = result['source'].upper()
                logger.info(
                    f"🔔 [{src}] New online order #{result['order_number']} "
                    f"— ₹{result['total_amount']:.0f} ({result['items_count']} items)"
                )
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Online order generation failed: {e}")


def start_scheduler():
    """
    Start the APScheduler with:
    - Daily 8 AM cron for agent analysis
    - Every 5 minutes interval for online order simulation
    """
    schedule_hour = int(os.getenv("AGENT_SCHEDULE_HOUR", "8"))
    online_interval = int(os.getenv("ONLINE_ORDER_INTERVAL_MINUTES", "5"))
    
    scheduler = BackgroundScheduler()
    
    # Schedule daily at configured hour (default: 8 AM)
    scheduler.add_job(
        daily_planning_job,
        trigger=CronTrigger(hour=schedule_hour, minute=0),
        id="daily_planning_brief",
        name="Daily Planning Brief",
        replace_existing=True
    )
    
    # Schedule online order generation every N minutes
    scheduler.add_job(
        online_order_job,
        trigger=IntervalTrigger(minutes=online_interval),
        id="online_order_simulation",
        name="Online Order Simulation (Zomato/Swiggy)",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info(f"⏰ Scheduler started — Daily brief at {schedule_hour}:00 AM")
    logger.info(f"🛵 Online orders will arrive every {online_interval} min")
    
    return scheduler


def stop_scheduler(scheduler):
    """Shutdown the scheduler gracefully"""
    if scheduler:
        scheduler.shutdown()
        logger.info("⏰ Scheduler stopped")

