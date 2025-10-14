import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from jose import JWTError, jwt
from fastapi import HTTPException, status
from pydantic import BaseModel
from config import settings


class TokenData(BaseModel):
    """Token data model"""
    username: Optional[str] = None
    token_type: str = "access"


class Token(BaseModel):
    """Token response model"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    """Login request model"""
    username: str
    password: str


class RefreshTokenRequest(BaseModel):
    """Refresh token request model"""
    refresh_token: str


class AuthService:
    """Authentication service for JWT token management"""
    
    def __init__(self):
        if not settings.jwt_secret_key:
            raise ValueError("JWT_SECRET_KEY environment variable is required")
        if not settings.username or not settings.password_hash:
            raise ValueError("USERNAME and PASSWORD_HASH environment variables are required")
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using SHA256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return AuthService.hash_password(password) == hashed_password
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_expire_minutes)
        
        to_encode.update({
            "exp": expire,
            "type": "access",
            "iat": datetime.now(timezone.utc)
        })
        
        encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm="HS256")
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days)
        
        to_encode.update({
            "exp": expire,
            "type": "refresh",
            "iat": datetime.now(timezone.utc),
            "jti": secrets.token_hex(16)  # Unique ID for refresh token
        })
        
        encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm="HS256")
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> TokenData:
        """Verify JWT token and return token data"""
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
            username: str = payload.get("sub")
            type_check: str = payload.get("type")
            
            if username is None or type_check != token_type:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            token_data = TokenData(username=username, token_type=type_check)
            return token_data
            
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    def authenticate_user(self, username: str, password: str) -> bool:
        """Authenticate user credentials"""
        if username != settings.username:
            return False
        if not self.verify_password(password, settings.password_hash):
            return False
        return True
    
    def create_tokens(self, username: str) -> Token:
        """Create access and refresh tokens for user"""
        access_token_expires = timedelta(minutes=settings.jwt_access_expire_minutes)
        refresh_token_expires = timedelta(days=settings.jwt_refresh_expire_days)
        
        access_token = self.create_access_token(
            data={"sub": username}, expires_delta=access_token_expires
        )
        refresh_token = self.create_refresh_token(
            data={"sub": username}, expires_delta=refresh_token_expires
        )
        
        return Token(access_token=access_token, refresh_token=refresh_token)
    
    def refresh_access_token(self, refresh_token: str) -> str:
        """Create new access token from refresh token"""
        try:
            # Verify refresh token
            token_data = self.verify_token(refresh_token, token_type="refresh")
            
            # Create new access token
            access_token_expires = timedelta(minutes=settings.jwt_access_expire_minutes)
            new_access_token = self.create_access_token(
                data={"sub": token_data.username}, expires_delta=access_token_expires
            )
            
            return new_access_token
            
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )


# Global auth service instance
auth_service = AuthService()