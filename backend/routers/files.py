from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import uuid

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
