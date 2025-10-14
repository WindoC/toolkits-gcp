from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # App configuration
    app_name: str = "Chat-AI"
    debug: bool = False
    
    # Google Cloud configuration
    google_api_key: str
    google_cloud_project: str
    firestore_database: str = "(default)"
    gcs_bucket: Optional[str] = None
    
    # JWT configuration (for Phase 3)
    jwt_secret_key: Optional[str] = None
    jwt_access_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 7
    
    # Single user credentials (for Phase 3)
    username: Optional[str] = None
    password_hash: Optional[str] = None
    
    
    # Rate limiting
    auth_rate_limit: int = 10  # requests per minute
    chat_rate_limit: int = 30  # requests per minute
    
    # Encryption configuration
    aes_key_hash: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
