"""
Ask-AI v2 — LangGraph Agentic Pipeline
Self-correcting Text-to-SQL with anomaly detection and auto-visualization.

Architecture:
  query_planner → sql_validator → sql_executor → insight_engine → rag_enricher → response_writer → END
                        ↑                ↑
                        └── retry ───────┘  (max 3 retries via query_planner)

  query_planner → (not relevant?) → response_writer → END  (polite decline path)
"""

import time
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Lazy imports to avoid import errors if langgraph not installed
_graph = None


def _build_graph():
    """Build the LangGraph StateGraph. Called once, cached."""
    global _graph
    if _graph is not None:
        return _graph

    try:
        from langgraph.graph import StateGraph, END
    except ImportError:
        logger.error("langgraph not installed. Run: pip install langgraph langchain-core")
        raise ImportError("langgraph is required for Ask-AI v2. Install with: pip install langgraph langchain-core")

    from services.ask_ai_v2.state import AgentState
    from services.ask_ai_v2.nodes.query_planner import query_planner
    from services.ask_ai_v2.nodes.sql_validator import sql_validator
    from services.ask_ai_v2.nodes.sql_executor import sql_executor
    from services.ask_ai_v2.nodes.insight_engine import insight_engine
    from services.ask_ai_v2.nodes.response_writer import response_writer
    from services.ask_ai_v2.knowledge_base import rag_enricher

    # ── Define Routing Functions ──────────────────────────────────

    def route_after_planner(state: dict) -> str:
        """After query_planner: skip to response if not relevant."""
        if not state.get("is_relevant", True):
            return "response_writer"
        return "sql_validator"

    def route_after_validator(state: dict) -> str:
        """After sql_validator: retry if invalid, proceed if valid."""
        if not state.get("sql_valid", False):
            retry_count = state.get("retry_count", 0)
            if retry_count < 3:
                return "query_planner_retry"
            else:
                return "response_writer"  # give up, respond with what we have
        return "sql_executor"

    def route_after_executor(state: dict) -> str:
        """After sql_executor: retry if error, proceed if success."""
        if state.get("query_error"):
            retry_count = state.get("retry_count", 0)
            if retry_count < 3:
                return "query_planner_retry"
            else:
                return "response_writer"
        return "insight_engine"

    # ── Retry wrapper that increments retry_count ──────────────────

    def query_planner_retry(state: dict) -> dict:
        """Increment retry count before re-entering query_planner."""
        new_count = state.get("retry_count", 0) + 1
        logger.info(f"🔄 SQL retry #{new_count}")
        result = query_planner({**state, "retry_count": new_count})
        result["retry_count"] = new_count
        return result

    # ── Build the Graph ───────────────────────────────────────────

    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("query_planner", query_planner)
    workflow.add_node("sql_validator", sql_validator)
    workflow.add_node("sql_executor", sql_executor)
    workflow.add_node("query_planner_retry", query_planner_retry)
    workflow.add_node("insight_engine", insight_engine)
    workflow.add_node("rag_enricher", rag_enricher)
    workflow.add_node("response_writer", response_writer)

    # Set entry point
    workflow.set_entry_point("query_planner")

    # Add edges
    workflow.add_conditional_edges("query_planner", route_after_planner, {
        "sql_validator": "sql_validator",
        "response_writer": "response_writer",
    })

    workflow.add_conditional_edges("sql_validator", route_after_validator, {
        "sql_executor": "sql_executor",
        "query_planner_retry": "query_planner_retry",
        "response_writer": "response_writer",
    })

    workflow.add_conditional_edges("sql_executor", route_after_executor, {
        "insight_engine": "insight_engine",
        "query_planner_retry": "query_planner_retry",
        "response_writer": "response_writer",
    })

    # Retry loops back to validator
    workflow.add_edge("query_planner_retry", "sql_validator")

    # Linear flow after successful execution
    workflow.add_edge("insight_engine", "rag_enricher")
    workflow.add_edge("rag_enricher", "response_writer")
    workflow.add_edge("response_writer", END)

    # Compile
    _graph = workflow.compile()
    logger.info("✅ Ask-AI v2 LangGraph pipeline compiled successfully")
    return _graph


# ─────────────────────────────────────────────────────────────────
# PUBLIC API — Called by the FastAPI route
# ─────────────────────────────────────────────────────────────────

def run_ask_ai_v2(
    user_query: str,
    restaurant_id: str,
    conversation_history: Optional[List[Dict]] = None
) -> Dict[str, Any]:
    """
    Run the Ask-AI v2 agentic pipeline.

    Args:
        user_query: The user's natural language question
        restaurant_id: UUID of the restaurant (from auth token)
        conversation_history: List of previous {role, content} messages

    Returns:
        Complete response dict with narrative, metrics, anomalies, viz, reasoning log
    """
    start = time.time()

    try:
        graph = _build_graph()
    except ImportError as e:
        return {
            "success": False,
            "error": str(e),
            "narrative": "Ask-AI v2 is not available. Required dependencies are missing.",
        }

    # Initialize state
    initial_state = {
        "user_query": user_query,
        "restaurant_id": restaurant_id,
        "conversation_history": conversation_history or [],
        # Defaults
        "query_type": "general",
        "extracted_entities": {},
        "is_relevant": True,
        "generated_sql": "",
        "semantic_context": "",
        "sql_valid": False,
        "validation_error": None,
        "query_result": None,
        "query_columns": None,
        "query_error": None,
        "result_empty": True,
        "retry_count": 0,
        "anomaly_detected": False,
        "anomaly_details": None,
        "delta_info": None,
        "benchmark_context": "",
        "visualization_spec": None,
        "domain_context": "",
        "narrative": "",
        "key_metrics": None,
        "recommendations": None,
        "confidence_score": 0.0,
        "steps_log": [],
        "total_tokens_used": 0,
        "latency_ms": 0.0,
        "error_message": None,
    }

    try:
        # Run the graph
        final_state = graph.invoke(initial_state)

        total_latency = round((time.time() - start) * 1000)

        # Build the structured response
        response = {
            "success": True,
            "response": {
                "narrative": final_state.get("narrative", ""),
                "key_metrics": final_state.get("key_metrics"),
                "anomaly": None,
                "visualization": final_state.get("visualization_spec"),
                "confidence_score": final_state.get("confidence_score", 0),
                "recommendations": final_state.get("recommendations"),
                "query_result": final_state.get("query_result"),
            },
            "metadata": {
                "sql_generated": final_state.get("generated_sql", ""),
                "query_type": final_state.get("query_type", ""),
                "retry_count": final_state.get("retry_count", 0),
                "latency_ms": total_latency,
                "tokens_used": final_state.get("total_tokens_used", 0),
                "steps_log": final_state.get("steps_log", []),
            },
        }

        # Add anomaly info if detected
        if final_state.get("anomaly_detected") and final_state.get("anomaly_details"):
            anomaly = final_state["anomaly_details"]
            response["response"]["anomaly"] = {
                "detected": True,
                "severity": anomaly.get("severity", "unknown"),
                "message": anomaly.get("message", ""),
                "z_score": anomaly.get("z_score", 0),
                "metric": anomaly.get("metric", ""),
                "current_value": anomaly.get("current_value"),
                "historical_mean": anomaly.get("historical_mean"),
                "pct_diff": anomaly.get("pct_diff"),
            }

        return response

    except Exception as e:
        total_latency = round((time.time() - start) * 1000)
        logger.error(f"Ask-AI v2 pipeline error: {e}", exc_info=True)
        return {
            "success": False,
            "response": {
                "narrative": f"I encountered an unexpected error while processing your question. Please try again.",
                "key_metrics": None,
                "anomaly": None,
                "visualization": None,
                "confidence_score": 0,
                "recommendations": None,
            },
            "metadata": {
                "latency_ms": total_latency,
                "error": str(e),
            },
        }
