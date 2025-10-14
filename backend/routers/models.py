from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict
import logging
from services import gemini_service
from middleware.auth_middleware import get_current_user
from services.auth_service import TokenData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("/", response_model=List[Dict[str, str]])
async def get_available_models(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get list of available Gemini models that support generateContent
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        List[Dict[str, str]]: List of models with id, name, and description
    """
    try:
        logger.info("Fetching available Gemini models")
        models = await gemini_service.get_available_models()
        return models
        
    except Exception as e:
        logger.error(f"Error fetching models: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch available models")