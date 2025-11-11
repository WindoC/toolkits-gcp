from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Request
from fastapi.responses import StreamingResponse
from typing import Optional
import uuid
import base64

from middleware.auth_middleware import get_current_user
from services.gcs_service import gcs_service
from services.auth_service import TokenData


router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/")
async def list_files(is_public: Optional[bool] = Query(None), current_user: TokenData = Depends(get_current_user)):
    try:
        return {"files": gcs_service.list_files(is_public=is_public)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    file_id: Optional[str] = Form(None),
    public: bool = Form(False),
    current_user: TokenData = Depends(get_current_user)
):
    try:
        data = await file.read()
        fid = file_id or str(uuid.uuid4())
        object_path, size = gcs_service.upload_from_bytes(data, fid, is_public=public)
        return {"file_id": fid, "object_path": object_path, "size": size, "is_public": public}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.post("/upload-encrypted")
async def upload_file_encrypted(
    request: Request,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Encrypted upload endpoint: client sends JSON { encrypted_data: "..." }.
    Decrypted payload contains { content_b64, file_id?, public? }.
    Server decrypts then stores plaintext bytes in GCS.
    """
    try:
        data = getattr(request.state, "decrypted_data", None)
        if not data:
            raise HTTPException(status_code=400, detail="Encrypted payload required")

        content_b64 = data.get("content_b64")
        if not content_b64:
            raise HTTPException(status_code=400, detail="content_b64 required")

        fid = data.get("file_id") or str(uuid.uuid4())
        public = bool(data.get("public", False))

        try:
            file_bytes = base64.b64decode(content_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 content")

        object_path, size = gcs_service.upload_from_bytes(file_bytes, fid, is_public=public)
        return {"file_id": fid, "object_path": object_path, "size": size, "is_public": public}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload encrypted file: {str(e)}")


@router.post("/upload-url")
async def upload_from_url(url: str = Form(...), file_id: Optional[str] = Form(None), public: bool = Form(False), current_user: TokenData = Depends(get_current_user)):
    try:
        fid = file_id or str(uuid.uuid4())
        object_path, size = gcs_service.upload_from_url(url, fid, is_public=public)
        return {"file_id": fid, "object_path": object_path, "size": size, "is_public": public}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload from URL: {str(e)}")


@router.get("/{file_id}")
async def get_file_info(file_id: str, public: bool = Query(False), current_user: TokenData = Depends(get_current_user)):
    try:
        info = gcs_service.get_file_info(file_id, is_public=public)
        return {"file_id": file_id, "is_public": public, **info}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get file info: {str(e)}")


@router.get("/{file_id}/download")
async def download_file(file_id: str, public: bool = Query(False), current_user: TokenData = Depends(get_current_user)):
    try:
        data = gcs_service.download_file(file_id, is_public=public)
        return StreamingResponse(iter([data]), media_type='application/octet-stream', headers={
            'Content-Disposition': f'attachment; filename="{file_id}"'
        })
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")


@router.patch("/{file_id}")
async def rename_file(file_id: str, new_file_id: str = Form(...), public: bool = Form(False), current_user: TokenData = Depends(get_current_user)):
    try:
        new_path = gcs_service.rename_file(file_id, new_file_id, is_public=public)
        return {"file_id": new_file_id, "object_path": new_path, "is_public": public}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename file: {str(e)}")


@router.delete("/{file_id}")
async def delete_file(file_id: str, public: bool = Query(False), current_user: TokenData = Depends(get_current_user)):
    try:
        ok = gcs_service.delete_file(file_id, is_public=public)
        if not ok:
            raise HTTPException(status_code=404, detail="File not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@router.post("/{file_id}/toggle-share")
async def toggle_share(file_id: str, current_public: bool = Form(False), current_user: TokenData = Depends(get_current_user)):
    try:
        new_path, new_public = gcs_service.toggle_share(file_id, current_public)
        return {"file_id": file_id, "object_path": new_path, "is_public": new_public}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle share: {str(e)}")


@router.get("/public/{file_id}")
async def public_download_file(file_id: str):
    try:
        data = gcs_service.download_file(file_id, is_public=True)
        return StreamingResponse(iter([data]), media_type='application/octet-stream', headers={
            'Content-Disposition': f'attachment; filename="{file_id}"'
        })
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")


@router.get("/{file_id}/download-encrypted")
async def download_file_encrypted(file_id: str, public: bool = Query(False), current_user: TokenData = Depends(get_current_user)):
    """
    Return file content as base64 in JSON; middleware encrypts the JSON.
    This keeps storage plaintext, transport app-encrypted.
    """
    try:
        data = gcs_service.download_file(file_id, is_public=public)
        content_b64 = base64.b64encode(data).decode('utf-8')
        return {
            "file_id": file_id,
            "size": len(data),
            "is_public": public,
            "content_b64": content_b64,
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")
