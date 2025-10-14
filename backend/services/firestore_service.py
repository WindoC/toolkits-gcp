from google.cloud import firestore
from typing import List, Optional, Dict, Any
import uuid
import logging
from datetime import datetime
from config import settings
from models import Conversation, Message, ConversationSummary, MessageRole

logger = logging.getLogger(__name__)


class FirestoreService:
    """Service for interacting with Firestore database"""
    
    def __init__(self):
        self.db = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the Firestore client"""
        try:
            self.db = firestore.Client(
                project=settings.google_cloud_project,
                database=settings.firestore_database
            )
            logger.info("Firestore client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Firestore client: {e}")
            raise
    
    async def create_conversation_with_grounding(self, first_message: Message, ai_message: Message, title: str = None) -> str:
        """
        Create a new conversation with the first user message and AI response (with grounding support)
        
        Args:
            first_message: The initial user message
            ai_message: The AI's message (with potential grounding data)
            title: Optional conversation title
            
        Returns:
            str: The conversation ID
        """
        try:
            conversation_id = str(uuid.uuid4())
            now = datetime.utcnow()
            
            # Set message IDs and timestamps if not already set
            if not first_message.message_id:
                first_message.message_id = str(uuid.uuid4())
            if not ai_message.message_id:
                ai_message.message_id = str(uuid.uuid4())
                ai_message.created_at = now
            
            # Create conversation document
            conversation_data = {
                "conversation_id": conversation_id,
                "title": title,
                "messages": [
                    first_message.model_dump(),
                    ai_message.model_dump()
                ],
                "created_at": now,
                "last_updated": now,
                "starred": False
            }
            
            # Save to Firestore
            doc_ref = self.db.collection("conversations").document(conversation_id)
            doc_ref.set(conversation_data)
            
            logger.info(f"Created conversation {conversation_id} with grounding support")
            return conversation_id
            
        except Exception as e:
            logger.error(f"Error creating conversation with grounding: {e}")
            raise

    async def create_conversation(self, first_message: Message, ai_response: str, title: str = None) -> str:
        """
        Create a new conversation with the first user message and AI response
        
        Args:
            first_message: The initial user message
            ai_response: The AI's response
            title: Optional conversation title
            
        Returns:
            str: The conversation ID
        """
        try:
            conversation_id = str(uuid.uuid4())
            now = datetime.utcnow()
            
            # Create AI response message
            ai_message = Message(
                message_id=str(uuid.uuid4()),
                role=MessageRole.AI,
                content=ai_response,
                created_at=now
            )
            
            # Create conversation document
            conversation_data = {
                "conversation_id": conversation_id,
                "title": title,
                "messages": [
                    first_message.model_dump(),
                    ai_message.model_dump()
                ],
                "created_at": now,
                "last_updated": now,
                "starred": False
            }
            
            # Save to Firestore
            doc_ref = self.db.collection("conversations").document(conversation_id)
            doc_ref.set(conversation_data)
            
            logger.info(f"Created conversation {conversation_id}")
            return conversation_id
            
        except Exception as e:
            logger.error(f"Error creating conversation: {e}")
            raise
    
    async def add_message_to_conversation_with_grounding(self, conversation_id: str, user_message: Message, ai_message: Message) -> bool:
        """
        Add a new user message and AI response to an existing conversation (with grounding support)
        
        Args:
            conversation_id: The conversation ID
            user_message: The user's message
            ai_message: The AI's message (with potential grounding data)
            
        Returns:
            bool: Success status
        """
        try:
            doc_ref = self.db.collection("conversations").document(conversation_id)
            
            # Check if conversation exists
            doc = doc_ref.get()
            if not doc.exists:
                logger.warning(f"Conversation {conversation_id} not found")
                return False
            
            # Set message IDs if not already set
            if not user_message.message_id:
                user_message.message_id = str(uuid.uuid4())
            if not ai_message.message_id:
                ai_message.message_id = str(uuid.uuid4())
            
            # Update conversation with new messages
            doc_ref.update({
                "messages": firestore.ArrayUnion([
                    user_message.model_dump(),
                    ai_message.model_dump()
                ]),
                "last_updated": datetime.utcnow()
            })
            
            logger.info(f"Added messages to conversation {conversation_id} with grounding support")
            return True
            
        except Exception as e:
            logger.error(f"Error adding message to conversation with grounding: {e}")
            return False

    async def add_message_to_conversation(self, conversation_id: str, user_message: Message, ai_response: str) -> bool:
        """
        Add a new user message and AI response to an existing conversation
        
        Args:
            conversation_id: The conversation ID
            user_message: The user's message
            ai_response: The AI's response
            
        Returns:
            bool: Success status
        """
        try:
            doc_ref = self.db.collection("conversations").document(conversation_id)
            
            # Check if conversation exists
            doc = doc_ref.get()
            if not doc.exists:
                logger.warning(f"Conversation {conversation_id} not found")
                return False
            
            # Create AI response message
            ai_message = Message(
                message_id=str(uuid.uuid4()),
                role=MessageRole.AI,
                content=ai_response,
                created_at=datetime.utcnow()
            )
            
            # Update conversation with new messages
            doc_ref.update({
                "messages": firestore.ArrayUnion([
                    user_message.model_dump(),
                    ai_message.model_dump()
                ]),
                "last_updated": datetime.utcnow()
            })
            
            logger.info(f"Added messages to conversation {conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding message to conversation: {e}")
            return False
    
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """
        Get a conversation by ID
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            Conversation: The conversation object, or None if not found
        """
        try:
            doc_ref = self.db.collection("conversations").document(conversation_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                return None
            
            data = doc.to_dict()
            
            # Convert messages to Message objects
            messages = []
            for msg_data in data.get("messages", []):
                messages.append(Message(**msg_data))
            
            return Conversation(
                conversation_id=data["conversation_id"],
                title=data.get("title"),
                messages=messages,
                created_at=data["created_at"],
                last_updated=data["last_updated"],
                starred=data.get("starred", False)
            )
            
        except Exception as e:
            logger.error(f"Error getting conversation {conversation_id}: {e}")
            return None
    
    async def list_conversations(self, limit: int = 50, offset: int = 0) -> List[ConversationSummary]:
        """
        List conversations ordered by last_updated (newest first)
        
        Args:
            limit: Maximum number of conversations to return
            offset: Number of conversations to skip
            
        Returns:
            List[ConversationSummary]: List of conversation summaries
        """
        try:
            # Query conversations ordered by last_updated
            query = self.db.collection("conversations")\
                          .order_by("last_updated", direction=firestore.Query.DESCENDING)\
                          .limit(limit)\
                          .offset(offset)
            
            docs = query.stream()
            summaries = []
            
            for doc in docs:
                data = doc.to_dict()
                messages = data.get("messages", [])
                
                # Get preview from the last message
                preview = None
                if messages:
                    last_message = messages[-1]
                    preview = last_message.get("content", "")[:100]
                    if len(last_message.get("content", "")) > 100:
                        preview += "..."
                
                summary = ConversationSummary(
                    conversation_id=data["conversation_id"],
                    title=data.get("title", "Untitled Conversation"),
                    created_at=data["created_at"],
                    last_updated=data["last_updated"],
                    starred=data.get("starred", False),
                    message_count=len(messages),
                    preview=preview
                )
                summaries.append(summary)
            
            return summaries
            
        except Exception as e:
            logger.error(f"Error listing conversations: {e}")
            return []
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        """
        Delete a conversation
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            bool: Success status
        """
        try:
            doc_ref = self.db.collection("conversations").document(conversation_id)
            doc_ref.delete()
            logger.info(f"Deleted conversation {conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            return False
    
    async def star_conversation(self, conversation_id: str, starred: bool) -> bool:
        """
        Star or unstar a conversation
        
        Args:
            conversation_id: The conversation ID
            starred: Whether to star or unstar
            
        Returns:
            bool: Success status
        """
        try:
            doc_ref = self.db.collection("conversations").document(conversation_id)
            doc_ref.update({"starred": starred})
            logger.info(f"{'Starred' if starred else 'Unstarred'} conversation {conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error starring conversation {conversation_id}: {e}")
            return False
    
    async def rename_conversation(self, conversation_id: str, title: str) -> bool:
        """
        Rename a conversation
        
        Args:
            conversation_id: The conversation ID
            title: New title for the conversation
            
        Returns:
            bool: Success status
        """
        try:
            doc_ref = self.db.collection("conversations").document(conversation_id)
            # Check if conversation exists
            doc = doc_ref.get()
            if not doc.exists:
                logger.warning(f"Conversation {conversation_id} not found for renaming")
                return False
            
            doc_ref.update({
                "title": title,
                "last_updated": datetime.utcnow()
            })
            logger.info(f"Renamed conversation {conversation_id} to '{title}'")
            return True
            
        except Exception as e:
            logger.error(f"Error renaming conversation {conversation_id}: {e}")
            return False
    
    async def bulk_delete_nonstarred(self) -> int:
        """
        Delete all non-starred conversations
        
        Returns:
            int: Number of conversations deleted
        """
        try:
            # Get all conversations and filter non-starred ones
            # This handles cases where 'starred' field might be missing or null
            all_docs = list(self.db.collection("conversations").stream())
            non_starred_docs = []
            
            for doc in all_docs:
                data = doc.to_dict()
                # Consider conversation non-starred if starred is False, None, or missing
                is_starred = data.get("starred", False)
                if is_starred != True:  # More explicit check - only keep if explicitly True
                    non_starred_docs.append(doc)
            
            logger.info(f"Found {len(non_starred_docs)} non-starred conversations to delete")
            
            # Delete in batches
            batch_size = 500
            deleted_count = 0
            
            for i in range(0, len(non_starred_docs), batch_size):
                batch = self.db.batch()
                batch_docs = non_starred_docs[i:i + batch_size]
                
                for doc in batch_docs:
                    batch.delete(doc.reference)
                
                batch.commit()
                deleted_count += len(batch_docs)
            
            logger.info(f"Bulk deleted {deleted_count} non-starred conversations")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error bulk deleting non-starred conversations: {e}")
            return 0


# Global service instance
firestore_service = FirestoreService()