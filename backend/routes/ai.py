from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas.ai_schemas import ChatRequest, ChatResponse, Intent
from services.ai_service import get_ai_service
from services.query_engine import QueryEngine
from routes.auth import get_current_user
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/ai", tags=["Ask-AI Chatbot"])

@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Main chat endpoint for Ask-AI chatbot
    Handles user messages, classifies intent, executes queries, and generates responses
    """
    try:
        ai_service = get_ai_service()
        
        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        # Classify intent
        intent = ai_service.classify_intent(request.message)
        
        # Execute action or query
        data = None
        if intent.needs_data:
            try:
                # Check if this is an action-based intent
                if intent.intent_type == "create_order":
                    from services.action_engine import get_action_engine
                    action_engine = get_action_engine()
                    data = action_engine.execute_action(
                        intent.intent_type,
                        intent.entities,
                        db,
                        str(current_user.restaurant_id),
                        str(current_user.id)
                    )
                else:
                    # Query-based intent
                    data = QueryEngine.execute_query(
                        intent.intent_type,
                        intent.entities,
                        db,
                        str(current_user.restaurant_id)
                    )
            except Exception as e:
                print(f"Query/Action execution error: {e}")
                import traceback
                traceback.print_exc()
                # Continue with empty data - AI will handle gracefully
        
        # Generate response
        response_message, chart_data = ai_service.generate_response(
            request.message,
            intent,
            data,
            conversation_id
        )
        
        # Store in conversation history
        from schemas.ai_schemas import ChatMessage
        ai_service.add_to_conversation(
            conversation_id,
            ChatMessage(role="user", content=request.message)
        )
        ai_service.add_to_conversation(
            conversation_id,
            ChatMessage(role="assistant", content=response_message)
        )
        
        return ChatResponse(
            message=response_message,
            intent=intent,
            data=data,
            chart_data=chart_data,
            conversation_id=conversation_id,
            timestamp=datetime.utcnow()
        )
        
    except Exception as e:
        print(f"Chat endpoint error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing your message: {str(e)}"
        )

@router.get("/history/{conversation_id}")
def get_history(
    conversation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get conversation history"""
    ai_service = get_ai_service()
    messages = ai_service.get_conversation(conversation_id)
    
    return {
        "conversation_id": conversation_id,
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat()
            }
            for msg in messages
        ]
    }

@router.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "ask-ai"}
