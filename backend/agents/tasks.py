"""
CrewAI Task Definitions for SujalPOS Agents
Each task defines what an agent should analyze and what output to produce
"""

from crewai import Task


def create_inventory_analysis_task(agent):
    """Create the inventory analysis task"""
    return Task(
        description="""Perform a comprehensive inventory health check for the restaurant.

You MUST use your tools to gather real data. Do the following:
1. Use 'Get Low Stock Items' to find ingredients below reorder level
2. Use 'Get Expiry Alerts' to find items expiring within 7 days
3. Use 'Get Wastage Data' to analyze wastage patterns (last 30 days)
4. Use 'Get Ingredient Usage' to calculate 7-day burn rates

Based on the data, produce:
- List of items needing immediate reorder (with urgency: CRITICAL/WARNING/OK)
- For each low-stock item, estimate days until stockout = current_stock / (weekly_usage / 7)
- Wastage cost analysis and reduction suggestions
- Expiry risk items that should be used first (FIFO recommendations)

Be specific with numbers. Use ₹ for currency. Round to 2 decimal places.""",
        expected_output="""A structured inventory analysis report with:
1. REORDER ALERTS: Items to reorder with urgency level, current stock, and estimated days until stockout
2. EXPIRY RISKS: Items expiring soon with recommended actions
3. WASTAGE ANALYSIS: Total wastage cost, top wasted items, and reduction suggestions
4. BURN RATE INSIGHTS: Which ingredients are consumed fastest
All numbers should be specific and data-driven.""",
        agent=agent
    )


def create_sales_analysis_task(agent):
    """Create the sales analysis task"""
    return Task(
        description="""Perform a deep sales analysis for the restaurant.

You MUST use your tools to gather real data. Do the following:
1. Use 'Get Sales Summary' to get weekly revenue, orders, and today's performance
2. Use 'Get Peak Hours Analysis' to identify busiest hours
3. Use 'Get Item Performance' to find best and worst selling items
4. Use 'Get Revenue Trends' to identify daily patterns

Based on the data, produce:
- Revenue summary (weekly total, daily average, today vs yesterday trend)
- Top 5 best-selling items by quantity AND revenue
- Bottom 3 worst-selling items (candidates for removal or promotion)
- Peak hours identification (for staffing optimization)
- Day-of-week patterns (which days are busiest)
- Growth/decline assessment

Be specific with numbers. Use ₹ for currency. Include percentage changes.""",
        expected_output="""A structured sales analysis report with:
1. REVENUE OVERVIEW: Weekly/daily revenue with trends
2. TOP PERFORMERS: Best-selling items by quantity and revenue
3. UNDERPERFORMERS: Items selling poorly with recommendations
4. PEAK HOURS: Busiest hours with staffing suggestions
5. PATTERNS: Day-of-week trends and growth trajectory
All numbers should be specific and data-driven.""",
        agent=agent
    )


def create_pricing_analysis_task(agent):
    """Create the dynamic pricing analysis task"""
    return Task(
        description="""Analyze menu pricing and suggest data-driven price optimizations.

You MUST use your tools to gather real data. Do the following:
1. Use 'Get Cost Analysis For All Items' to get cost/margin for each menu item
2. Use 'Get Item Performance' to see sales volume per item
3. Use 'Get Peak Hours Analysis' to understand demand patterns

Based on the data, produce pricing recommendations:
- Items with LOW margin (<30%) that need price increases
- Items with HIGH margin (>60%) and HIGH volume — potential for premium pricing
- Items with HIGH margin but LOW volume — candidates for promotion/discount
- Time-based pricing suggestions (e.g., lunch specials, dinner premium)
- Bundle/combo suggestions based on popular combinations

For each recommendation:
- Current price → Suggested price
- Expected impact on revenue (conservative estimate)
- Reasoning based on data

Use ₹ for currency. Be realistic — suggest max 10-15% price changes.""",
        expected_output="""A structured pricing optimization report with:
1. PRICE INCREASE SUGGESTIONS: Low-margin items with new prices
2. PREMIUM OPPORTUNITIES: High-demand items that can be priced higher
3. PROMOTION CANDIDATES: High-margin, low-volume items needing visibility
4. TIME-BASED PRICING: Peak/off-peak pricing suggestions
5. ESTIMATED REVENUE IMPACT: Conservative revenue change estimate
Each suggestion should have current price, new price, reasoning, and expected impact.""",
        agent=agent
    )


def create_daily_brief_task(agent, context_tasks):
    """Create the AI Co-Pilot's daily brief synthesis task"""
    return Task(
        description="""You are the AI Co-Pilot for this restaurant. Synthesize all the analysis 
from the Inventory Agent, Sales Agent, and Dynamic Pricing Agent into one 
actionable "Next Day Planning Brief."

Using the context from previous agent analyses, create a brief that a restaurant 
owner can read in 2 minutes and immediately know what to do tomorrow.

Structure your brief as follows:

🎯 TOP 3 PRIORITIES (most urgent actions for tomorrow)

📦 INVENTORY ACTION ITEMS
- What to reorder TODAY
- Items to use before expiry (FIFO)
- Wastage reduction actions

💰 SALES INSIGHTS
- Yesterday/today performance summary (1-2 lines)
- Top seller highlight
- Underperformer action

🏷️ PRICING RECOMMENDATIONS
- Top 2-3 pricing changes to implement
- Expected revenue impact

📊 TOMORROW'S FORECAST
- Expected revenue range
- Expected order volume
- Key preparation notes (e.g., "Stock extra chicken for Saturday rush")

⚠️ RISK ALERTS (if any)
- Critical stock shortages
- Expiring items
- Revenue decline warnings

Keep it CONCISE, ACTIONABLE, and DATA-DRIVEN. 
Use ₹ for currency. Use specific numbers, not vague language.
The owner should be able to act on every point immediately.""",
        expected_output="""A concise, professional daily planning brief with:
- TOP 3 PRIORITIES (numbered, actionable)
- INVENTORY ACTIONS (reorder list, expiry alerts)
- SALES INSIGHTS (revenue, trends, top/bottom items)
- PRICING RECOMMENDATIONS (specific price changes)
- TOMORROW'S FORECAST (revenue/order predictions)
- RISK ALERTS (critical warnings)
Maximum 400 words. Every point must be data-backed and actionable.""",
        agent=agent,
        context=context_tasks
    )
