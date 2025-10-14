from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class MessageRole(str, Enum):
    """Message role enumeration"""
    USER = "user"
    AI = "ai"


class Message(BaseModel):
    """Chat message model"""
    message_id: Optional[str] = None
    role: MessageRole
    content: str
    references: Optional[List["Reference"]] = None
    search_queries: Optional[List[str]] = None
    grounding_supports: Optional[List["GroundingSupport"]] = None
    url_context_urls: Optional[List[str]] = None
    grounded: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GroundingSupport(BaseModel):
    """Grounding support model for text segments"""
    start_index: int
    end_index: int
    text: str
    reference_indices: List[int]


class Reference(BaseModel):
    """Reference model for search grounding citations"""
    id: int
    title: str
    url: str
    domain: str
    snippet: Optional[str] = None


class ChatRequest(BaseModel):
    """Chat request model"""
    message: str = Field(..., min_length=1, max_length=4000)
    enable_search: bool = False  # Google Search grounding
    url_context: Optional[List[str]] = None  # URL context for enhanced responses
    model: str = "gemini-2.5-flash"  # Selected Gemini model


class StarRequest(BaseModel):
    """Star/unstar request model"""
    starred: bool


class RenameRequest(BaseModel):
    """Rename conversation request model"""
    title: str = Field(..., min_length=1, max_length=100)


class ChatResponse(BaseModel):
    """Chat response model"""
    success: bool = True
    conversation_id: Optional[str] = None
    message: Optional[str] = None
    references: Optional[List[Reference]] = None
    search_queries: Optional[List[str]] = None
    grounding_supports: Optional[List[GroundingSupport]] = None
    url_context_urls: Optional[List[str]] = None
    grounded: bool = False
    error: Optional[str] = None


class Conversation(BaseModel):
    """Conversation model"""
    conversation_id: str
    title: Optional[str] = None
    messages: List[Message] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    starred: bool = False


class ConversationSummary(BaseModel):
    """Conversation summary for listing"""
    conversation_id: str
    title: Optional[str] = None
    created_at: datetime
    last_updated: datetime
    starred: bool = False
    message_count: int = 0
    preview: Optional[str] = None


class ConversationList(BaseModel):
    """Conversation list response"""
    conversations: List[ConversationSummary]
    total: int
    has_more: bool = False


class HealthCheck(BaseModel):
    """Health check response"""
    status: str = "healthy"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = "1.0.0"


class APIResponse(BaseModel):
    """Generic API response wrapper"""
    success: bool = True
    data: Optional[dict] = None
    message: Optional[str] = None
    error: Optional[dict] = None


class Note(BaseModel):
    """Note model"""
    note_id: str
    title: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    owner: Optional[str] = None


class NoteSummary(BaseModel):
    """Note summary for listing"""
    note_id: str
    title: str
    created_at: datetime
    updated_at: datetime
