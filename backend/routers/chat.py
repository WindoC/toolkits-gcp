from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
import json
import logging
import asyncio
from typing import AsyncGenerator, Optional, List
from models import ChatRequest, Message, MessageRole
from services import gemini_service, firestore_service
from middleware.auth_middleware import get_current_user
from services.auth_service import TokenData
from services.encryption_service import EncryptionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def create_sse_stream(message: str, encryption_key: str, conversation_id: str = None, enable_search: bool = False, model: str = "gemini-2.5-flash") -> AsyncGenerator[str, None]:
    """
    Create Server-Sent Events stream for chat response
    
    Args:
        message: User message
        encryption_key: Key for encrypting response data
        conversation_id: Optional existing conversation ID
        enable_search: Enable Google Search grounding
        model: Gemini model to use
        
    Yields:
        str: SSE formatted data
    """
    try:
        # Get conversation history if continuing existing chat
        conversation_history = []
        if conversation_id:
            conversation = await firestore_service.get_conversation(conversation_id)
            if conversation:
                # Convert messages to format expected by Gemini
                conversation_history = [
                    {"role": msg.role.value, "content": msg.content}
                    for msg in conversation.messages
                ]
        
        # Send conversation ID event if this is a new chat
        if not conversation_id:
            yield f"data: {json.dumps({'type': 'conversation_start'})}\n\n"
        
        # Initialize variables for grounding
        references = []
        search_queries = []
        grounding_supports = []
        url_context_urls = []
        grounded = False
        
        if enable_search:
            # Use non-streaming grounding method for search requests to get metadata
            complete_response, references, search_queries, grounding_supports, url_context_urls, grounded = await gemini_service.generate_response_with_grounding(
                message, conversation_history, enable_search, None, model
            )
            
            encrypted_chunk = EncryptionService.encrypt_response({'content': complete_response}, encryption_key)
            yield f"data: {json.dumps({'type': 'encrypted_chunk', 'encrypted_data': encrypted_chunk['encrypted_data']})}\n\n"

        else:
            # Use real streaming for normal requests (no search/grounding needed)
            complete_response = ""
            async for chunk in gemini_service.generate_response_stream(message, conversation_history, enable_search, model):
                complete_response += chunk
                # Encrypt and stream each chunk in real-time
                encrypted_chunk = EncryptionService.encrypt_response({'content': chunk}, encryption_key)
                yield f"data: {json.dumps({'type': 'encrypted_chunk', 'encrypted_data': encrypted_chunk['encrypted_data']})}\n\n"
        
        # Save conversation to Firestore
        if conversation_id:
            # Add to existing conversation
            user_message = Message(role=MessageRole.USER, content=message)
            ai_message = Message(
                role=MessageRole.AI, 
                content=complete_response,
                references=references,
                search_queries=search_queries,
                grounding_supports=grounding_supports,
                url_context_urls=url_context_urls,
                grounded=grounded
            )
            await firestore_service.add_message_to_conversation_with_grounding(
                conversation_id, user_message, ai_message
            )
            final_conversation_id = conversation_id
        else:
            # Create new conversation
            user_message = Message(role=MessageRole.USER, content=message)
            ai_message = Message(
                role=MessageRole.AI, 
                content=complete_response,
                references=references,
                search_queries=search_queries,
                grounding_supports=grounding_supports,
                url_context_urls=url_context_urls,
                grounded=grounded
            )
            title = await gemini_service.generate_title(message)
            final_conversation_id = await firestore_service.create_conversation_with_grounding(
                user_message, ai_message, title
            )
        
        # Send final event with conversation ID and grounding metadata
        final_data = {
            'type': 'done', 
            'conversation_id': final_conversation_id
        }
        if grounded:
            final_data.update({
                'references': [ref.dict() for ref in references],
                'search_queries': search_queries,
                'grounding_supports': [support.dict() for support in grounding_supports],
                'url_context_urls': url_context_urls,
                'grounded': grounded
            })
        
        # Encrypt final event data
        encrypted_final_data = EncryptionService.encrypt_response(final_data, encryption_key)
        yield f"data: {json.dumps({'type': 'encrypted_done', 'encrypted_data': encrypted_final_data['encrypted_data']})}\n\n"
        
    except Exception as e:
        logger.error(f"Error in SSE stream: {e}")
        error_msg = "An error occurred while generating the response. Please try again."
        yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"


@router.post("/")
async def start_chat(
    request: Request,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Start a new chat conversation with streaming response
    
    Args:
        request: FastAPI request object with decrypted data
        current_user: Current authenticated user
        
    Returns:
        StreamingResponse: Server-Sent Events stream
    """
    try:
        # Get decrypted data from middleware
        if not hasattr(request.state, 'decrypted_data'):
            raise HTTPException(status_code=400, detail="Encrypted payload required")
        
        decrypted_data = request.state.decrypted_data
        chat_request = ChatRequest(**decrypted_data)
        
        logger.info(f"Starting new chat with message: {chat_request.message[:100]}...")
        
        return StreamingResponse(
            create_sse_stream(chat_request.message, request.state.encryption_key, enable_search=chat_request.enable_search, model=chat_request.model),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
    except Exception as e:
        logger.error(f"Error starting chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to start chat")


@router.post("/{conversation_id}")
async def continue_chat(
    conversation_id: str,
    request: Request,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Continue an existing chat conversation with streaming response
    
    Args:
        conversation_id: ID of the existing conversation
        request: FastAPI request object with decrypted data
        current_user: Current authenticated user
        
    Returns:
        StreamingResponse: Server-Sent Events stream
    """
    try:
        # Get decrypted data from middleware
        if not hasattr(request.state, 'decrypted_data'):
            raise HTTPException(status_code=400, detail="Encrypted payload required")
        
        decrypted_data = request.state.decrypted_data
        chat_request = ChatRequest(**decrypted_data)
        
        logger.info(f"Continuing chat {conversation_id} with message: {chat_request.message[:100]}...")
        
        # Verify conversation exists
        conversation = await firestore_service.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return StreamingResponse(
            create_sse_stream(chat_request.message, request.state.encryption_key, conversation_id, chat_request.enable_search, chat_request.model),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error continuing chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to continue chat")