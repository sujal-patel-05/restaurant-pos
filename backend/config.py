import os
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"
    
    # Application
    APP_NAME: str = "Restaurant POS System"
    DEBUG: bool = True
    
    # Gemini AI
    GEMINI_API_KEY: str = None
    
    # Ollama AI
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "tinyllama"

    # Groq AI
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    AI_PROVIDER: str = "groq"  # 'groq' or 'ollama'
    
    # Sarvam AI (Speech-to-Text)
    SARVAM_API_KEY: Optional[str] = None
    
    # Twilio (Phone Call Bot)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    
    # Email / SMTP
    OWNER_EMAIL: Optional[str] = None
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SENDER_EMAIL: Optional[str] = None
    SENDER_PASSWORD: Optional[str] = None
    
    # Agent Scheduler
    AGENT_SCHEDULE_HOUR: int = 8  # 8 AM daily
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
