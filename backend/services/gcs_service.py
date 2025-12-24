import os
from typing import List, Optional, Tuple
from google.cloud import storage
from google.cloud.exceptions import NotFound
import requests
from io import BytesIO
from urllib.parse import quote
from config import settings


class GCSService:
    def __init__(self):
        self.project_id = settings.google_cloud_project
        self.bucket_name = settings.gcs_bucket or os.getenv("GCS_BUCKET", "")
        self.client = storage.Client(project=self.project_id) if self.project_id else None
        self.bucket = self.client.bucket(self.bucket_name) if self.client and self.bucket_name else None

    def _get_object_path(self, file_id: str, is_public: bool = False) -> str:
        folder = "public" if is_public else "private"
        return f"{folder}/{file_id}"

    def _public_url_for_path(self, object_path: str) -> Optional[str]:
        if not self.bucket_name:
            return None
        bucket = self.bucket_name.replace("gs://", "").strip("/")
        normalized_path = quote(object_path.lstrip("/"), safe="/")
        return f"https://storage.googleapis.com/{bucket}/{normalized_path}"

    def upload_from_url(self, url: str, file_id: str, is_public: bool = False, max_size: int = 200 * 1024 * 1024) -> Tuple[str, int]:
        if not self.bucket:
            raise Exception("GCS not configured")

        response = requests.get(url, stream=True)
        response.raise_for_status()

        content_length = response.headers.get('content-length')
        if content_length and int(content_length) > max_size:
            raise ValueError(f"File too large: {content_length} bytes")

        data = BytesIO()
        size = 0
        for chunk in response.iter_content(chunk_size=8192):
            size += len(chunk)
            if size > max_size:
                raise ValueError(f"File too large: {size} bytes")
            data.write(chunk)

        data.seek(0)
        object_path = self._get_object_path(file_id, is_public)
        blob = self.bucket.blob(object_path)
        blob.upload_from_file(data)

        return object_path, size

    def upload_from_bytes(self, file_data: bytes, file_id: str, is_public: bool = False, max_size: int = 200 * 1024 * 1024) -> Tuple[str, int]:
        if not self.bucket:
            raise Exception("GCS not configured")

        size = len(file_data)
        if size > max_size:
            raise ValueError(f"File too large: {size} bytes")

        object_path = self._get_object_path(file_id, is_public)
        blob = self.bucket.blob(object_path)
        blob.upload_from_string(file_data)

        return object_path, size

    def list_files(self, is_public: Optional[bool] = None) -> List[dict]:
        if not self.bucket:
            return []

        files = []
        if is_public is None:
            prefixes = ["private/", "public/"]
        else:
            prefixes = ["public/"] if is_public else ["private/"]

        for prefix in prefixes:
            blobs = self.bucket.list_blobs(prefix=prefix)
            for blob in blobs:
                if blob.name != prefix:
                    file_id = blob.name.split("/", 1)[1]
                    item = {
                        "file_id": file_id,
                        "object_path": blob.name,
                        "size": blob.size,
                        "is_public": blob.name.startswith("public/")
                    }
                    if item["is_public"]:
                        url = self._public_url_for_path(blob.name)
                        if url:
                            item["public_url"] = url
                    files.append(item)

        return files

    def download_file(self, file_id: str, is_public: bool = False) -> bytes:
        if not self.bucket:
            raise Exception("GCS not configured")

        object_path = self._get_object_path(file_id, is_public)
        blob = self.bucket.blob(object_path)

        try:
            return blob.download_as_bytes()
        except NotFound:
            raise FileNotFoundError(f"File not found: {file_id}")

    def rename_file(self, old_file_id: str, new_file_id: str, is_public: bool = False) -> str:
        if not self.bucket:
            raise Exception("GCS not configured")

        old_path = self._get_object_path(old_file_id, is_public)
        new_path = self._get_object_path(new_file_id, is_public)

        old_blob = self.bucket.blob(old_path)
        new_blob = self.bucket.copy_blob(old_blob, self.bucket, new_path)
        old_blob.delete()

        return new_path

    def delete_file(self, file_id: str, is_public: bool = False) -> bool:
        if not self.bucket:
            raise Exception("GCS not configured")

        object_path = self._get_object_path(file_id, is_public)
        blob = self.bucket.blob(object_path)

        try:
            blob.delete()
            return True
        except NotFound:
            return False

    def toggle_share(self, file_id: str, current_is_public: bool) -> Tuple[str, bool]:
        if not self.bucket:
            raise Exception("GCS not configured")

        old_path = self._get_object_path(file_id, current_is_public)
        new_is_public = not current_is_public
        new_path = self._get_object_path(file_id, new_is_public)

        old_blob = self.bucket.blob(old_path)
        new_blob = self.bucket.copy_blob(old_blob, self.bucket, new_path)
        old_blob.delete()

        return new_path, new_is_public

    def file_exists(self, file_id: str, is_public: bool = False) -> bool:
        if not self.bucket:
            return False

        object_path = self._get_object_path(file_id, is_public)
        blob = self.bucket.blob(object_path)
        return blob.exists()

    def get_file_info(self, file_id: str, is_public: bool = False) -> dict:
        if not self.bucket:
            raise Exception("GCS not configured")

        object_path = self._get_object_path(file_id, is_public)
        blob = self.bucket.blob(object_path)

        try:
            blob.reload()
            info = {
                "size": blob.size,
                "content_type": blob.content_type,
                "created": blob.time_created,
                "updated": blob.updated
            }
            if is_public:
                url = self._public_url_for_path(object_path)
                if url:
                    info["public_url"] = url
            return info
        except NotFound:
            raise FileNotFoundError(f"File not found: {file_id}")


gcs_service = GCSService()
