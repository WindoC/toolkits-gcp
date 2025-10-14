import time
from collections import defaultdict, deque
from typing import Dict, Deque
from fastapi import Request, HTTPException, status
from fastapi.responses import Response
from config import settings


class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests: Dict[str, Deque[float]] = defaultdict(deque)
    
    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        """Check if request is allowed within rate limit"""
        now = time.time()
        window_start = now - window_seconds
        
        # Clean old requests
        request_times = self.requests[key]
        while request_times and request_times[0] < window_start:
            request_times.popleft()
        
        # Check if we've exceeded the limit
        if len(request_times) >= max_requests:
            return False
        
        # Add current request
        request_times.append(now)
        return True


# Global rate limiter instance
rate_limiter = RateLimiter()


async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # Content Security Policy
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "font-src 'self'; "
        "object-src 'none'; "
        "media-src 'none'; "
        "frame-src 'none';"
    )
    response.headers["Content-Security-Policy"] = csp
    
    # HSTS (only for HTTPS)
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    return response


async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware"""
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    
    # Define rate limits for different endpoints
    if path.startswith("/auth/"):
        max_requests = settings.auth_rate_limit
    elif path.startswith("/api/chat"):
        max_requests = settings.chat_rate_limit
    else:
        max_requests = 100  # Default rate limit
    
    # Create rate limit key
    rate_key = f"{client_ip}:{path.split('/')[1] if '/' in path else 'root'}"
    
    if not rate_limiter.is_allowed(rate_key, max_requests, 60):  # 60-second window
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Too many requests.",
            headers={"Retry-After": "60"}
        )
    
    return await call_next(request)