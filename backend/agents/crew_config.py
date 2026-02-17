"""
CrewAI Crew Configuration for SujalPOS
Pre-fetches restaurant data and injects it into agent prompts directly.
This avoids LLM tool-calling issues with Groq models entirely.
"""

import os
import json
import time
import traceback
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

# Disable CrewAI telemetry to avoid signal handler issues in background threads
os.environ["CREWAI_TELEMETRY_OPT_OUT"] = "true"
os.environ["OTEL_SDK_DISABLED"] = "true"
os.environ["LITELLM_DROP_PARAMS"] = "true"

from crewai import Agent, Crew, Process, Task
from database import SessionLocal
from models import Restaurant, MenuItem
from services.report_service import ReportService
from services.inventory_service import InventoryService


def _safe_json(data):
    """Convert data to JSON-safe string"""
    def default_serializer(obj):
        if hasattr(obj, 'isoformat'):
            return obj.isoformat()
        if hasattr(obj, '__float__'):
            return float(obj)
        return str(obj)
    return json.dumps(data, indent=2, default=default_serializer)


def _fetch_all_data():
    """
    Pre-fetch ALL restaurant data from the database.
    This runs synchronously before agents start, so no tool calling is needed.
    """
    db = SessionLocal()
    try:
        restaurant = db.query(Restaurant).first()
        if not restaurant:
            return {"error": "No restaurant found in database"}

        end_date = datetime.utcnow()
        start_7d = end_date - timedelta(days=7)
        start_30d = end_date - timedelta(days=30)

        # Dashboard stats
        dashboard = ReportService.get_dashboard_stats(db, restaurant.id)

        # Sales data
        weekly_sales = ReportService.get_sales_report(db, restaurant.id, start_7d, end_date)
        peak_hours = ReportService.get_peak_hours(db, restaurant.id, start_7d, end_date)
        item_sales = ReportService.get_item_wise_sales(db, restaurant.id, start_7d, end_date)
        charts = ReportService.get_dashboard_charts(db, restaurant.id)

        # Inventory data
        low_stock = InventoryService.get_low_stock_alerts(db, restaurant.id)
        expiry = InventoryService.get_expiry_alerts(db, restaurant.id, days=7)
        wastage = ReportService.get_wastage_report(db, restaurant.id, start_30d, end_date)
        usage = ReportService.get_ingredient_usage(db, restaurant.id, start_7d, end_date)

        # Cost analysis
        menu_items = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_available == True
        ).all()
        cost_data = []
        for item in menu_items:
            cd = ReportService.get_cost_per_dish(db, item.id)
            if cd.get("success"):
                cost_data.append({
                    "item": cd["menu_item"],
                    "selling_price": cd["selling_price"],
                    "cost": cd["total_cost"],
                    "profit_margin": cd["profit_margin"],
                    "profit_pct": round(cd["profit_percentage"], 1)
                })

        return {
            "dashboard": _safe_json(dashboard),
            "weekly_sales": _safe_json(weekly_sales),
            "peak_hours": _safe_json(peak_hours or []),
            "item_sales": _safe_json(item_sales or []),
            "revenue_trends": _safe_json(charts),
            "low_stock": _safe_json(low_stock or []),
            "expiry_alerts": _safe_json(expiry or []),
            "wastage": _safe_json(wastage),
            "ingredient_usage": _safe_json(usage or []),
            "cost_analysis": _safe_json(cost_data),
            "low_stock_count": len(low_stock or []),
            "expiry_count": len(expiry or []),
            "cost_items_count": len(cost_data),
        }
    finally:
        db.close()


def _get_llm():
    """Get LLM string for CrewAI agents"""
    api_key = os.getenv("GROQ_API_KEY")
    agent_model = os.getenv("GROQ_AGENT_MODEL", "llama-3.3-70b-versatile")

    if not api_key:
        raise ValueError("GROQ_API_KEY not set. CrewAI agents require a Groq API key.")

    return f"groq/{agent_model}"


def run_analysis():
    """
    Run the full multi-agent analysis.
    1. Pre-fetches ALL data from DB
    2. Creates agents with NO tools (just LLM reasoning)
    3. Injects data directly into task prompts
    4. Returns results
    """
    try:
        # Step 1: Fetch all data
        data = _fetch_all_data()
        if "error" in data:
            return {"success": False, "error": data["error"]}

        llm = _get_llm()

        # Step 2: Create agents (NO tools — data is pre-fetched)
        inventory_agent = Agent(
            role="Senior Inventory Analyst",
            goal="Analyze stock levels, predict shortages, minimize wastage",
            backstory="Expert inventory manager with 15 years of restaurant supply chain experience. Meticulous with numbers.",
            llm=llm,
            verbose=True,
            max_iter=2,
            memory=False,
            tools=[]
        )

        sales_agent = Agent(
            role="Revenue & Sales Strategist",
            goal="Analyze sales performance, identify patterns, find growth opportunities",
            backstory="Seasoned restaurant analyst who has helped 100+ restaurants optimize revenue.",
            llm=llm,
            verbose=True,
            max_iter=2,
            memory=False,
            tools=[]
        )

        pricing_agent = Agent(
            role="Pricing Optimization Specialist",
            goal="Optimize menu pricing using cost analysis and demand patterns",
            backstory="Menu engineering expert who understands pricing psychology and profit optimization.",
            llm=llm,
            verbose=True,
            max_iter=2,
            memory=False,
            tools=[]
        )

        copilot_agent = Agent(
            role="Restaurant AI Co-Pilot",
            goal="Synthesize all insights into a concise, actionable daily planning brief",
            backstory="Trusted AI advisor to the restaurant owner. Prioritizes ruthlessly — every word must drive action.",
            llm=llm,
            verbose=True,
            max_iter=2,
            memory=False,
            tools=[]
        )

        # Step 3: Create tasks WITH data injected into descriptions
        inventory_task = Task(
            description=f"""Analyze this restaurant's inventory data and produce an inventory health report.

HERE IS THE ACTUAL DATA:

**Low Stock Alerts ({data['low_stock_count']} items):**
{data['low_stock']}

**Expiry Alerts ({data['expiry_count']} items expiring in 7 days):**
{data['expiry_alerts']}

**Wastage Report (Last 30 days):**
{data['wastage']}

**Ingredient Usage (Last 7 days):**
{data['ingredient_usage']}

**Today's Dashboard:**
{data['dashboard']}

Based on this data, produce:
1. REORDER ALERTS: Items needing reorder with urgency (CRITICAL/WARNING/OK)
2. EXPIRY RISKS: Items to use first (FIFO)
3. WASTAGE ANALYSIS: Cost impact and reduction suggestions
4. BURN RATE: Which ingredients are consumed fastest

Use ₹ for currency. Be specific with numbers. Keep it under 300 words.""",
            expected_output="Structured inventory health report with reorder alerts, expiry risks, wastage analysis, and burn rates.",
            agent=inventory_agent
        )

        sales_task = Task(
            description=f"""Analyze this restaurant's sales data and produce a sales performance report.

HERE IS THE ACTUAL DATA:

**Weekly Sales Summary:**
{data['weekly_sales']}

**Today's Dashboard (vs Yesterday):**
{data['dashboard']}

**Peak Hours (Last 7 days):**
{data['peak_hours']}

**Item-wise Sales Performance:**
{data['item_sales']}

**Revenue Trends (Daily):**
{data['revenue_trends']}

Based on this data, produce:
1. REVENUE OVERVIEW: Weekly/daily revenue with trends
2. TOP PERFORMERS: Best-selling items
3. UNDERPERFORMERS: Items selling poorly
4. PEAK HOURS: Busiest hours for staffing
5. PATTERNS: Day-of-week trends

Use ₹ for currency. Include percentages. Keep it under 300 words.""",
            expected_output="Structured sales report with revenue overview, top/bottom sellers, peak hours, and trends.",
            agent=sales_agent
        )

        pricing_task = Task(
            description=f"""Analyze menu pricing and suggest optimizations.

HERE IS THE ACTUAL DATA:

**Cost Analysis ({data['cost_items_count']} items):**
{data['cost_analysis']}

**Item Sales Performance:**
{data['item_sales']}

**Peak Hours:**
{data['peak_hours']}

Based on this data, produce:
1. PRICE INCREASE targets: Low-margin items (<30%) that need price increases
2. PREMIUM OPPORTUNITIES: High-demand, high-margin items
3. PROMOTION CANDIDATES: High-margin items with low sales volume
4. Specific suggestions: Current price → New price with reasoning

Use ₹ for currency. Suggest max 10-15% changes. Keep it under 250 words.""",
            expected_output="Pricing optimization report with specific price change suggestions and expected impact.",
            agent=pricing_agent
        )

        daily_brief_task = Task(
            description="""You are the AI Co-Pilot. Synthesize the three agent reports into ONE
concise daily planning brief the restaurant owner can read in 2 minutes.

Structure:
🎯 TOP 3 PRIORITIES (most urgent actions for tomorrow)
📦 INVENTORY ACTIONS (reorder, use-before-expiry, wastage fixes)
💰 SALES INSIGHTS (revenue summary, top item, weak item)
🏷️ PRICING SUGGESTIONS (top 2-3 price changes)
📊 TOMORROW FORECAST (expected revenue range, preparation tips)
⚠️ RISK ALERTS (if any critical issues)

Rules:
- Maximum 350 words
- Every point must be data-backed and actionable
- Use ₹ for currency
- Use specific numbers, not vague language
- The owner should act on every point immediately""",
            expected_output="Concise daily planning brief with priorities, inventory actions, sales insights, pricing, forecast, and alerts.",
            agent=copilot_agent,
            context=[inventory_task, sales_task, pricing_task]
        )

        # Step 4: Create and run crew
        crew = Crew(
            agents=[inventory_agent, sales_agent, pricing_agent, copilot_agent],
            tasks=[inventory_task, sales_task, pricing_task, daily_brief_task],
            process=Process.sequential,
            verbose=True,
            max_rpm=10
        )

        result = crew.kickoff()

        # Extract outputs
        task_outputs = []
        if hasattr(result, 'tasks_output'):
            for task_output in result.tasks_output:
                task_outputs.append({
                    "agent": task_output.agent if hasattr(task_output, 'agent') else "Unknown",
                    "description": (task_output.description[:80] + "...") if hasattr(task_output, 'description') and task_output.description else "",
                    "output": str(task_output)
                })

        return {
            "success": True,
            "daily_brief": str(result),
            "task_outputs": task_outputs,
            "token_usage": result.token_usage if hasattr(result, 'token_usage') else None
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
