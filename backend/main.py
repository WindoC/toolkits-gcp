from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import os
import logging
from datetime import datetime
from routers import chat_router, conversations_router, notes_router, files_router
from routers.auth import router as auth_router
from routers.models import router as models_router
from middleware.security_middleware import add_security_headers, rate_limit_middleware
from middleware.encryption_middleware import EncryptionMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info("Starting Chat-AI backend...")
    yield
    logger.info("Shutting down Chat-AI backend...")


# Create FastAPI app
app = FastAPI(
    title="Chat-AI API",
    description="Secure AI chat application with Google Gemini integration",
    version="1.0.0",
    lifespan=lifespan
)

# Add security middleware
app.middleware("http")(add_security_headers)
app.middleware("http")(rate_limit_middleware)

# Add encryption middleware
app.add_middleware(EncryptionMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(models_router)
app.include_router(notes_router)
app.include_router(files_router)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Chat-AI API is running",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
