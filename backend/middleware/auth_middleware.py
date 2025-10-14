from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from services.auth_service import auth_service, TokenData


# Initialize HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> TokenData:
    """
    Dependency to get current authenticated user from JWT token.
    
    Args:
        credentials: HTTP Bearer credentials from request header
        
    Returns:
        TokenData: Validated token data containing username
        
    Raises:
        HTTPException: If token is missing or invalid
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify the access token
    token_data = auth_service.verify_token(credentials.credentials, token_type="access")
    
    return token_data


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[TokenData]:
    """
    Optional dependency to get current authenticated user from JWT token.
    Returns None if no token is provided or token is invalid.
    
    Args:
        credentials: HTTP Bearer credentials from request header
        
    Returns:
        TokenData or None: Validated token data or None if not authenticated
    """
    if credentials is None:
        return None
    
    try:
        token_data = auth_service.verify_token(credentials.credentials, token_type="access")
        return token_data
    except HTTPException:
        return None