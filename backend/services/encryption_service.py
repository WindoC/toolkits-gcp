import json
import base64
import hashlib
from typing import Dict, Any, Optional, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag
import secrets
from config import settings


class EncryptionService:
    """Service for AES-GCM encryption/decryption operations"""
    
    @staticmethod
    def get_server_encryption_key() -> str:
        """
        Get encryption key from server secret only
        No JWT or client data involved in encryption
        """
        if not settings.aes_key_hash:
            raise ValueError("Encryption not configured - missing AES_KEY_HASH environment variable")
        
        # Use server secret directly for encryption (first 32 chars)
        return settings.aes_key_hash[:32]
    
    @staticmethod
    def encrypt_data(data: Dict[str, Any], key: str) -> str:
        """
        Encrypt data using AES-GCM
        Returns base64-encoded string containing nonce + ciphertext + tag
        """
        # Convert data to JSON bytes
        json_data = json.dumps(data, separators=(',', ':')).encode('utf-8')
        
        # Derive 32-byte key from input key using SHA256
        key_bytes = hashlib.sha256(key.encode('utf-8')).digest()
        
        # Generate random 12-byte nonce
        nonce = secrets.token_bytes(12)
        
        # Encrypt using AES-GCM
        aesgcm = AESGCM(key_bytes)
        ciphertext = aesgcm.encrypt(nonce, json_data, None)
        
        # Combine nonce + ciphertext and encode as base64
        encrypted_payload = nonce + ciphertext
        return base64.b64encode(encrypted_payload).decode('utf-8')
    
    @staticmethod
    def decrypt_data(encrypted_data: str, key: str) -> Dict[str, Any]:
        """
        Decrypt AES-GCM encrypted data
        Returns decrypted data as dictionary
        """
        try:
            # Decode base64
            encrypted_payload = base64.b64decode(encrypted_data)
            
            # Extract nonce (first 12 bytes) and ciphertext
            if len(encrypted_payload) < 12:
                raise ValueError("Invalid encrypted payload")
            
            nonce = encrypted_payload[:12]
            ciphertext = encrypted_payload[12:]
            
            # Derive 32-byte key from input key using SHA256
            key_bytes = hashlib.sha256(key.encode('utf-8')).digest()
            
            # Decrypt using AES-GCM
            aesgcm = AESGCM(key_bytes)
            decrypted_data = aesgcm.decrypt(nonce, ciphertext, None)
            
            # Parse JSON
            return json.loads(decrypted_data.decode('utf-8'))
            
        except (InvalidTag, ValueError, json.JSONDecodeError, Exception) as e:
            raise ValueError(f"Decryption failed: {str(e)}")
    
    @staticmethod
    def encrypt_response(data: Dict[str, Any], key: str) -> Dict[str, str]:
        """
        Encrypt response data for client
        Returns dictionary with encrypted_data field
        """
        encrypted_data = EncryptionService.encrypt_data(data, key)
        return {"encrypted_data": encrypted_data}


