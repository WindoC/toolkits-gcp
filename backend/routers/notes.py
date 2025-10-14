from fastapi import APIRouter, HTTPException, Depends, Request, status
from typing import List
from datetime import datetime
import uuid

from middleware.auth_middleware import get_current_user
from services.firestore_service import FirestoreService
from services.encryption_service import EncryptionService
from services.auth_service import TokenData


router = APIRouter(prefix="/api/notes", tags=["notes"])
_fs: FirestoreService | None = None


def get_fs() -> FirestoreService:
    global _fs
    if _fs is None:
        _fs = FirestoreService()
    return _fs


@router.get("/", response_model=List[dict])
async def list_notes(current_user: TokenData = Depends(get_current_user)):
    try:
        fs = get_fs()
        notes_ref = fs.db.collection("notes").where("owner", "==", current_user.username)
        docs = list(notes_ref.stream())
        result = []
        for d in docs:
            data = d.to_dict()
            # Decrypt content for response (plaintext in-memory, will be encrypted in transit by middleware)
            try:
                decrypted = EncryptionService.decrypt_data(data.get("content_encrypted"), EncryptionService.get_server_encryption_key())
                content = decrypted.get("content")
            except Exception:
                content = None
            result.append({
                "note_id": data.get("note_id", d.id),
                "title": data.get("title"),
                "content": content,
                "created_at": data.get("created_at"),
                "updated_at": data.get("updated_at")
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list notes: {str(e)}")


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_note(request: Request, current_user: TokenData = Depends(get_current_user)):
    try:
        fs = get_fs()
        decrypted = getattr(request.state, "decrypted_data", None)
        if not decrypted:
            raise HTTPException(status_code=400, detail="Missing decrypted payload")
        title = decrypted.get("title")
        content = decrypted.get("content")
        if not title or content is None:
            raise HTTPException(status_code=400, detail="title and content are required")

        note_id = str(uuid.uuid4())
        now = datetime.utcnow()

        # Encrypt content for at-rest storage
        content_encrypted = EncryptionService.encrypt_data({"content": content}, EncryptionService.get_server_encryption_key())

        data = {
            "note_id": note_id,
            "title": title,
            "content_encrypted": content_encrypted,
            "owner": current_user.username,
            "created_at": now,
            "updated_at": now
        }
        fs.db.collection("notes").document(note_id).set(data)

        return {"note_id": note_id, "title": title, "content": content, "created_at": now, "updated_at": now}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create note: {str(e)}")


@router.get("/{note_id}", response_model=dict)
async def get_note(note_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        fs = get_fs()
        doc = fs.db.collection("notes").document(note_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Note not found")
        data = doc.to_dict()
        if data.get("owner") != current_user.username:
            raise HTTPException(status_code=403, detail="Forbidden")

        decrypted = EncryptionService.decrypt_data(data.get("content_encrypted"), EncryptionService.get_server_encryption_key())
        return {
            "note_id": data.get("note_id", note_id),
            "title": data.get("title"),
            "content": decrypted.get("content"),
            "created_at": data.get("created_at"),
            "updated_at": data.get("updated_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get note: {str(e)}")


@router.put("/{note_id}", response_model=dict)
async def update_note(note_id: str, request: Request, current_user: TokenData = Depends(get_current_user)):
    try:
        fs = get_fs()
        doc_ref = fs.db.collection("notes").document(note_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Note not found")
        data = doc.to_dict()
        if data.get("owner") != current_user.username:
            raise HTTPException(status_code=403, detail="Forbidden")

        decrypted = getattr(request.state, "decrypted_data", None)
        if not decrypted:
            raise HTTPException(status_code=400, detail="Missing decrypted payload")

        title = decrypted.get("title", data.get("title"))
        content = decrypted.get("content")
        now = datetime.utcnow()

        updates = {"title": title, "updated_at": now}
        if content is not None:
            content_encrypted = EncryptionService.encrypt_data({"content": content}, EncryptionService.get_server_encryption_key())
            updates["content_encrypted"] = content_encrypted

        doc_ref.update(updates)

        return {"note_id": note_id, "title": title, "content": content if content is not None else None, "updated_at": now}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update note: {str(e)}")


@router.delete("/{note_id}", response_model=dict)
async def delete_note(note_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        fs = get_fs()
        doc_ref = fs.db.collection("notes").document(note_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Note not found")
        data = doc.to_dict()
        if data.get("owner") != current_user.username:
            raise HTTPException(status_code=403, detail="Forbidden")
        doc_ref.delete()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete note: {str(e)}")
