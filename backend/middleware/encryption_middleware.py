from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import json
from typing import Dict, Any, Optional
from services.encryption_service import EncryptionService


class EncryptionMiddleware(BaseHTTPMiddleware):
    """Middleware to handle encryption/decryption for protected endpoints"""
    
    ENCRYPTED_ENDPOINTS = {
        "/api/chat",
        "/api/conversations",
        "/api/notes"
    }
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Check if this endpoint requires encryption
        path = request.url.path
        requires_encryption = any(path.startswith(endpoint) for endpoint in self.ENCRYPTED_ENDPOINTS)
        
        if not requires_encryption:
            return await call_next(request)
        
        # Get server-side encryption key (no client data involved)
        try:
            encryption_key = EncryptionService.get_server_encryption_key()
        except ValueError as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "success": False,
                    "error": {
                        "code": "ENCRYPTION_CONFIG_ERROR",
                        "message": str(e)
                    }
                }
            )
        
        # Store encryption key in request state for use by endpoints
        request.state.encryption_key = encryption_key
        
        # Handle POST/PATCH/PUT requests with encrypted payloads
        if request.method in ["POST", "PATCH", "PUT"]:
            try:
                # Read and decrypt request body
                body = await request.body()
                if not body:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "success": False,
                            "error": {
                                "code": "ENCRYPTION_PAYLOAD_MISSING",
                                "message": "Encrypted payload required"
                            }
                        }
                    )
                
                # Parse JSON body
                try:
                    encrypted_payload = json.loads(body.decode('utf-8'))
                    if "encrypted_data" not in encrypted_payload:
                        return JSONResponse(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            content={
                                "success": False,
                                "error": {
                                    "code": "ENCRYPTION_FORMAT_INVALID",
                                    "message": "Payload must contain 'encrypted_data' field"
                                }
                            }
                        )
                except json.JSONDecodeError:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "success": False,
                            "error": {
                                "code": "ENCRYPTION_JSON_INVALID",
                                "message": "Invalid JSON in request body"
                            }
                        }
                    )
                
                # Decrypt the payload
                try:
                    decrypted_data = EncryptionService.decrypt_data(
                        encrypted_payload["encrypted_data"], 
                        encryption_key
                    )
                    request.state.decrypted_data = decrypted_data
                except ValueError as e:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "success": False,
                            "error": {
                                "code": "DECRYPTION_FAILED",
                                "message": str(e)
                            }
                        }
                    )
                
            except Exception as e:
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "success": False,
                        "error": {
                            "code": "ENCRYPTION_ERROR",
                            "message": f"Encryption processing failed: {str(e)}"
                        }
                    }
                )
        
        # Call the endpoint
        response = await call_next(request)
        
        # Encrypt response for successful requests if not SSE
        if (response.status_code in [200,201] and 
            "text/event-stream" not in response.headers.get("content-type", "")):
            try:
                # Read response body
                response_body = b"".join([chunk async for chunk in response.body_iterator])
                response_data = json.loads(response_body.decode('utf-8'))
                
                # Encrypt the response
                encrypted_response = EncryptionService.encrypt_response(response_data, encryption_key)
                
                # Return new encrypted response (exclude Content-Length to avoid mismatch)
                response_headers = dict(response.headers)
                response_headers.pop('content-length', None)  # Remove Content-Length if present
                
                return JSONResponse(
                    content=encrypted_response,
                    status_code=response.status_code,
                    headers=response_headers
                )
            except Exception as e:
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "success": False,
                        "error": {
                            "code": "RESPONSE_ENCRYPTION_FAILED",
                            "message": f"Failed to encrypt response: {str(e)}"
                        }
                    }
                )
        
        return response
