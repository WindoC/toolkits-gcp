from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer
from services.auth_service import (
    auth_service, 
    LoginRequest, 
    RefreshTokenRequest, 
    Token,
    TokenData
)
from middleware.auth_middleware import get_current_user
from models import APIResponse
import logging


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(login_request: LoginRequest):
    """
    Authenticate user and return JWT tokens.
    
    Args:
        login_request: User credentials (username and password)
        
    Returns:
        Token: Access and refresh JWT tokens
        
    Raises:
        HTTPException: If credentials are invalid
    """
    try:
        # Authenticate user
        if not auth_service.authenticate_user(login_request.username, login_request.password):
            logger.warning(f"Failed login attempt for username: {login_request.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create tokens
        tokens = auth_service.create_tokens(login_request.username)
        
        logger.info(f"Successful login for user: {login_request.username}")
        return tokens
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )


@router.post("/refresh", response_model=dict)
async def refresh_token(refresh_request: RefreshTokenRequest):
    """
    Refresh access token using refresh token.
    
    Args:
        refresh_request: Refresh token
        
    Returns:
        dict: New access token
        
    Raises:
        HTTPException: If refresh token is invalid or expired
    """
    try:
        new_access_token = auth_service.refresh_access_token(refresh_request.refresh_token)
        
        logger.info("Access token refreshed successfully")
        return {
            "access_token": new_access_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh service error"
        )


@router.post("/logout", response_model=APIResponse)
async def logout(current_user: TokenData = Depends(get_current_user)):
    """
    Logout user (client should clear tokens from storage).
    
    Note: Since we use stateless JWT tokens, actual logout is handled
    client-side by removing tokens from storage. This endpoint serves
    as a validation that the user is authenticated and logs the logout event.
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        APIResponse: Logout confirmation
    """
    try:
        logger.info(f"User logged out: {current_user.username}")
        return APIResponse(
            success=True,
            message="Logged out successfully"
        )
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout service error"
        )


@router.get("/me", response_model=dict)
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    """
    Get current user information.
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        dict: User information
    """
    return {
        "username": current_user.username,
        "authenticated": True
    }