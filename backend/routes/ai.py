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
    Handles user messages, classifies intent, executes queries, and generates responses.
    
    Supports smart follow-up flows:
    - "Change price of coke" → AI asks for new price → User types "100" → Price updated instantly
    - "Remove samosa" → AI asks for confirmation → User types "yes" → Item removed
    """
    try:
        ai_service = get_ai_service()
        
        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or str(uuid.uuid4())
        restaurant_id_str = str(current_user.restaurant_id)
        user_id_str = str(current_user.id)
        
        # ═══════════════════════════════════════════════════════════
        # STEP 0: Check for pending follow-up actions FIRST
        # This is what makes "100" resolve to a price update instantly
        # ═══════════════════════════════════════════════════════════
        resolved = ai_service.resolve_pending_action(
            conversation_id, request.message, db, restaurant_id_str, user_id_str
        )
        
        if resolved:
            # Follow-up was resolved! Use the result directly
            intent_type = resolved['intent_type']
            data = resolved['data']
            intent = Intent(
                intent_type=intent_type,
                confidence=1.0,
                entities={},
                needs_data=True
            )
            
            # Generate response from the resolved action data
            response_message, chart_data = ai_service.generate_response(
                request.message, intent, data, conversation_id
            )
            
            # Store conversation history
            from schemas.ai_schemas import ChatMessage
            ai_service.add_to_conversation(
                conversation_id,
                ChatMessage(role="user", content=request.message),
                restaurant_id_str, user_id_str
            )
            ai_service.add_to_conversation(
                conversation_id,
                ChatMessage(role="assistant", content=response_message),
                restaurant_id_str, user_id_str
            )
            
            return ChatResponse(
                message=response_message,
                intent=intent,
                data=data,
                chart_data=chart_data,
                conversation_id=conversation_id,
                timestamp=datetime.utcnow()
            )
        
        # ═══════════════════════════════════════════════════════════
        # STEP 1: Normal intent classification
        # ═══════════════════════════════════════════════════════════
        intent = ai_service.classify_intent(request.message)
        
        # ═══════════════════════════════════════════════════════════
        # STEP 1.5: Multi-Operation Handling
        # If the classifier detects a compound command, decompose
        # and execute all operations before generating response
        # ═══════════════════════════════════════════════════════════
        if intent.intent_type == "multi_operation":
            try:
                multi_result = ai_service.execute_multi_operation(
                    request.message, db, restaurant_id_str, user_id_str
                )
                
                if multi_result:
                    data = multi_result
                    response_message = multi_result.get('message', 'Operations completed.')
                    chart_data = None
                    
                    # Use LLM to polish the response if available
                    if ai_service.use_llm and ai_service.llm_service:
                        try:
                            conversation_history = ai_service.get_conversation(
                                conversation_id, restaurant_id_str, user_id_str
                            ) if conversation_id else []
                            llm_response = ai_service.llm_service.generate_intelligent_response(
                                request.message, "multi_operation", multi_result, conversation_history
                            )
                            if llm_response:
                                response_message = llm_response
                        except Exception:
                            pass  # Fall back to template response
                    
                    # Store conversation history
                    from schemas.ai_schemas import ChatMessage
                    ai_service.add_to_conversation(
                        conversation_id,
                        ChatMessage(role="user", content=request.message),
                        restaurant_id_str, user_id_str
                    )
                    ai_service.add_to_conversation(
                        conversation_id,
                        ChatMessage(role="assistant", content=response_message),
                        restaurant_id_str, user_id_str
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
                print(f"Multi-operation error: {e}")
                import traceback
                traceback.print_exc()
                # Fall through to normal single-intent handling
        
        # Execute action or query
        data = None
        if intent.needs_data:
            try:
                # Check if this is an action-based intent
                ACTION_INTENTS = {"create_order", "update_menu_item", "add_menu_item", "delete_menu_item"}
                if intent.intent_type in ACTION_INTENTS:
                    from services.action_engine import get_action_engine
                    action_engine = get_action_engine()
                    data = action_engine.execute_action(
                        intent.intent_type,
                        intent.entities,
                        db,
                        restaurant_id_str,
                        user_id_str
                    )
                    
                    # ═══════════════════════════════════════════════
                    # STEP 2: If action returned pending, store it
                    # so the NEXT message can resolve it instantly
                    # ═══════════════════════════════════════════════
                    if data and data.get('pending'):
                        ai_service.set_pending_action(conversation_id, data)
                else:
                    # Query-based intent
                    data = QueryEngine.execute_query(
                        intent.intent_type,
                        intent.entities,
                        db,
                        restaurant_id_str
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
            ChatMessage(role="user", content=request.message),
            restaurant_id_str,
            user_id_str
        )
        ai_service.add_to_conversation(
            conversation_id,
            ChatMessage(role="assistant", content=response_message),
            restaurant_id_str,
            user_id_str
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
    messages = ai_service.get_conversation(
        conversation_id, 
        str(current_user.restaurant_id), 
        str(current_user.id)
    )
    
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

@router.get("/conversations")
def list_conversations(
    current_user: User = Depends(get_current_user)
):
    """List all conversations for the sidebar"""
    ai_service = get_ai_service()
    return {"conversations": ai_service.list_conversations(str(current_user.restaurant_id), str(current_user.id))}

@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a conversation"""
    ai_service = get_ai_service()
    deleted = ai_service.delete_conversation(conversation_id, str(current_user.restaurant_id), str(current_user.id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted", "conversation_id": conversation_id}
