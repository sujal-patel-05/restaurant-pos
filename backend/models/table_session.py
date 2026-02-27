"""
Models for Voice Table Ordering System
- TableConfig: physical table definitions
- TableSession: customer visit sessions
- VoiceOrderLog: voice order processing logs (training data)
"""
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Float, Text, ForeignKey, DECIMAL
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from database import Base


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    BILLED = "billed"


class TableConfig(Base):
    __tablename__ = "table_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    table_id = Column(String(20), unique=True, nullable=False)  # "T1", "T2", etc.
    table_number = Column(String(20), nullable=False)
    table_name = Column(String(100))  # Optional label like "Window Table"
    capacity = Column(Integer, default=4)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    restaurant = relationship("Restaurant")
    sessions = relationship("TableSession", back_populates="table_config")


class TableSession(Base):
    __tablename__ = "table_sessions"

    id = Column(String(100), primary_key=True)  # e.g. SESSION-T5-20260226-143022
    restaurant_id = Column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    table_config_id = Column(String(36), ForeignKey("table_configs.id"), nullable=True)
    table_id = Column(String(20), nullable=False)
    table_number = Column(String(20), nullable=False)
    session_token = Column(Text)  # JWT token for this session
    pax = Column(Integer, default=1)  # Number of guests
    status = Column(String(20), default=SessionStatus.ACTIVE.value)
    session_start = Column(DateTime, default=datetime.utcnow)
    session_end = Column(DateTime, nullable=True)
    total_orders = Column(Integer, default=0)
    total_spent = Column(DECIMAL(10, 2), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    table_config = relationship("TableConfig", back_populates="sessions")
    voice_logs = relationship("VoiceOrderLog", back_populates="session")


class VoiceOrderLog(Base):
    __tablename__ = "voice_order_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(100), ForeignKey("table_sessions.id"), nullable=False)
    table_id = Column(String(20), nullable=False)
    audio_file_path = Column(String(500))
    raw_transcript = Column(Text)  # What Whisper heard
    parsed_json = Column(Text)    # What LLM extracted (JSON string)
    matched_json = Column(Text)   # After fuzzy matching (JSON string)
    confidence_avg = Column(Float, default=0.0)
    order_id = Column(String(36), ForeignKey("orders.id"), nullable=True)  # Filled after confirmation
    was_confirmed = Column(Boolean, default=False)
    was_edited = Column(Boolean, default=False)
    whisper_model = Column(String(20), default="base")
    processing_time_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("TableSession", back_populates="voice_logs")
