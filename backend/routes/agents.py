"""
API Routes for CrewAI Multi-Agent System
Provides endpoints to run agents, get insights, and manage configuration
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from routes.auth import get_current_user
from models import User
from datetime import datetime
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["AI Agents"])

# In-memory storage for analysis results (persists during server uptime)
_analysis_history = []
_current_run = {"running": False, "started_at": None}


def _run_agents_background():
    """Background task to run the full agent analysis and email results"""
    global _current_run
    _current_run = {"running": True, "started_at": datetime.now().isoformat()}
    
    try:
        from agents.crew_config import run_analysis
        result = run_analysis()
        
        # Store in history
        entry = {
            "id": len(_analysis_history) + 1,
            "timestamp": datetime.now().isoformat(),
            "success": result.get("success", False),
            "daily_brief": result.get("daily_brief", ""),
            "task_outputs": result.get("task_outputs", []),
            "error": result.get("error"),
            "token_usage": result.get("token_usage")
        }
        _analysis_history.insert(0, entry)
        
        # Keep only last 30 entries
        if len(_analysis_history) > 30:
            _analysis_history.pop()
        
        # Auto-send email on success
        if result.get("success"):
            logger.info("✅ Agent analysis completed — sending email brief...")
            owner_email = os.getenv("OWNER_EMAIL")
            if owner_email:
                try:
                    from services.email_service import EmailService
                    EmailService.send_daily_brief(
                        to_email=owner_email,
                        brief_content=result.get("daily_brief", ""),
                        date=datetime.now().strftime("%B %d, %Y"),
                        task_outputs=result.get("task_outputs", [])
                    )
                    logger.info(f"📧 Brief emailed to {owner_email}")
                except Exception as email_err:
                    logger.error(f"❌ Email failed: {email_err}")
            else:
                logger.warning("⚠️ OWNER_EMAIL not set — skipping email")
        else:
            logger.error(f"❌ Agent analysis failed: {result.get('error')}")
        
    except Exception as e:
        logger.error(f"❌ Agent analysis failed: {e}")
        _analysis_history.insert(0, {
            "id": len(_analysis_history) + 1,
            "timestamp": datetime.now().isoformat(),
            "success": False,
            "error": str(e)
        })
    finally:
        _current_run = {"running": False, "started_at": None}


@router.post("/run")
async def run_agents(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger a full agent analysis run.
    Runs in background — check /api/agents/status for progress.
    """
    if _current_run["running"]:
        raise HTTPException(
            status_code=409,
            detail="An analysis is already running. Please wait for it to complete."
        )
    
    background_tasks.add_task(_run_agents_background)
    
    return {
        "message": "Agent analysis started in background",
        "status": "running",
        "started_at": datetime.now().isoformat()
    }


@router.get("/status")
async def get_agent_status(
    current_user: User = Depends(get_current_user)
):
    """Get the current status of agent analysis"""
    return {
        "running": _current_run["running"],
        "started_at": _current_run.get("started_at"),
        "last_completed": _analysis_history[0]["timestamp"] if _analysis_history else None,
        "total_runs": len(_analysis_history)
    }


@router.get("/insights")
async def get_latest_insights(
    current_user: User = Depends(get_current_user)
):
    """
    Get the most recent agent analysis results.
    Returns the daily brief and individual agent outputs.
    """
    if not _analysis_history:
        return {
            "available": False,
            "message": "No analysis has been run yet. Click 'Run Analysis' to start.",
            "data": None
        }
    
    latest = _analysis_history[0]
    return {
        "available": True,
        "data": latest
    }


@router.get("/history")
async def get_analysis_history(
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    """
    Get history of past agent analysis runs.
    Returns the last N runs (default: 10).
    """
    return {
        "total": len(_analysis_history),
        "entries": _analysis_history[:limit]
    }


@router.get("/brief/{run_id}")
async def get_specific_brief(
    run_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get a specific daily brief by run ID"""
    for entry in _analysis_history:
        if entry.get("id") == run_id:
            return entry
    
    raise HTTPException(status_code=404, detail="Brief not found")
