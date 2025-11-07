import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


def test_health_check(client):
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert data["version"] == "1.0.0"


def test_root_endpoint(client):
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    
    data = response.json()
    assert data["message"] == "Toolkits API is running"
    assert data["version"] == "1.0.0"
    assert data["docs"] == "/docs"


@patch('backend.services.gemini_service.gemini_service')
@patch('backend.services.firestore_service.firestore_service')
def test_chat_endpoint_new_conversation(mock_firestore, mock_gemini, client):
    """Test starting a new chat conversation"""
    # Mock Gemini service
    mock_gemini.generate_response_stream.return_value = iter(["Hello", " there!"])
    mock_gemini.generate_title.return_value = "Test Conversation"
    
    # Mock Firestore service
    mock_firestore.create_conversation.return_value = "test-conversation-id"
    
    response = client.post("/api/chat/", json={"message": "Hello"})
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


@patch('backend.services.firestore_service.firestore_service')
def test_conversations_list_empty(mock_firestore, client):
    """Test listing conversations when there are none"""
    mock_firestore.list_conversations.return_value = []
    
    response = client.get("/api/conversations/")
    assert response.status_code == 200
    
    data = response.json()
    assert data["conversations"] == []
    assert data["total"] == 0
    assert data["has_more"] == False


@patch('backend.services.firestore_service.firestore_service')
def test_conversation_not_found(mock_firestore, client):
    """Test getting a conversation that doesn't exist"""
    mock_firestore.get_conversation.return_value = None
    
    response = client.get("/api/conversations/nonexistent-id")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()