from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ChatMessage(BaseModel):
    """Single chat message"""
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = datetime.utcnow()

class ChatRequest(BaseModel):
    """Request to chat endpoint"""
    message: str
    conversation_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None  # Additional context (user role, restaurant_id, etc.)

class Intent(BaseModel):
    """Classified intent from user message"""
    intent_type: str  # 'sales_query', 'inventory_query', 'order_status', 'menu_info', 'general'
    confidence: float  # 0.0 to 1.0
    entities: Dict[str, Any]  # Extracted entities (dates, item names, order IDs, etc.)
    needs_data: bool  # Whether this intent requires database query

class ChatResponse(BaseModel):
    """Response from chat endpoint"""
    message: str
    intent: Optional[Intent] = None
    data: Optional[Dict[str, Any]] = None  # Structured data if query was executed
    chart_data: Optional[Dict[str, Any]] = None  # Data for frontend visualization
    conversation_id: str
    timestamp: datetime = datetime.utcnow()

class ConversationHistory(BaseModel):
    """Conversation history"""
    conversation_id: str
    messages: List[ChatMessage]
    created_at: datetime
    updated_at: datetime
