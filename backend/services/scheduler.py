"""
APScheduler Service for SujalPOS
Runs daily agent analysis at 8 AM IST and emails the brief to the restaurant owner
"""

import os
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

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


def start_scheduler():
    """
    Start the APScheduler with a daily 8 AM IST cron trigger.
    Returns the scheduler instance.
    """
    schedule_hour = int(os.getenv("AGENT_SCHEDULE_HOUR", "8"))
    
    scheduler = BackgroundScheduler()
    
    # Schedule daily at configured hour (default: 8 AM)
    scheduler.add_job(
        daily_planning_job,
        trigger=CronTrigger(hour=schedule_hour, minute=0),
        id="daily_planning_brief",
        name="Daily Planning Brief",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info(f"⏰ Scheduler started — Daily brief at {schedule_hour}:00 AM")
    
    return scheduler


def stop_scheduler(scheduler):
    """Shutdown the scheduler gracefully"""
    if scheduler:
        scheduler.shutdown()
        logger.info("⏰ Scheduler stopped")
