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

try:
    settings = Settings()
except Exception as e:
    print(f"\n[FATAL] Configuration Error: {e}")
    # Provide a fallback for the app to at least start and log the error
    class FallbackSettings:
        DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fallback.db")
        SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-12345")
        ALGORITHM = "HS256"
        ACCESS_TOKEN_EXPIRE_MINUTES = 60
        CORS_ORIGINS = "*"
        APP_NAME = "Restaurant POS (Fallback Mode)"
        DEBUG = True
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        OLLAMA_BASE_URL = "http://localhost:11434"
        OLLAMA_MODEL = "tinyllama"
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        GROQ_MODEL = "llama-3.3-70b-versatile"
        AI_PROVIDER = "groq"
        SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
        TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
        TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
        TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
        OWNER_EMAIL = os.getenv("OWNER_EMAIL")
        SMTP_SERVER = "smtp.gmail.com"
        SMTP_PORT = 587
        SENDER_EMAIL = os.getenv("SENDER_EMAIL")
        SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")
        AGENT_SCHEDULE_HOUR = 8
        
        @property
        def cors_origins_list(self):
            return ["*"]

    settings = FallbackSettings()
    print("[WARN] Using Fallback Settings. Please check your Environment Variables on Render.")
