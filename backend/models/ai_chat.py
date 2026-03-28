from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database import Base

class AIChatHistory(Base):
    """
    Stores persistent conversation history for Ask-AI
    """
    __tablename__ = "ai_chat_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    conversation_id = Column(String(50), nullable=False, index=True)
    title = Column(String(255), default="New Chat")
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    restaurant = relationship("Restaurant")
    user = relationship("User")
