import pytest
from backend.services.encryption_service import EncryptionService


class FakeGCS:
    def __init__(self):
        self.store = {False: {}, True: {}}
    def upload_from_bytes(self, data: bytes, file_id: str, is_public=False):
        self.store[is_public][file_id] = data
        return (f"{'public' if is_public else 'private'}/{file_id}", len(data))
    def upload_from_url(self, url: str, file_id: str, is_public=False):
        content = b"url-bytes"
        self.store[is_public][file_id] = content
        return (f"{'public' if is_public else 'private'}/{file_id}", len(content))
    def list_files(self, is_public=None):
        items = []
        if is_public is None:
            spaces = [False, True]
        else:
            spaces = [is_public]
        for pub in spaces:
            for fid, data in self.store[pub].items():
                items.append({
                    "file_id": fid,
                    "object_path": f"{'public' if pub else 'private'}/{fid}",
                    "size": len(data),
                    "is_public": pub
                })
        return items
    def download_file(self, file_id: str, is_public=False):
        return self.store[is_public][file_id]
    def rename_file(self, old_file_id: str, new_file_id: str, is_public=False):
        self.store[is_public][new_file_id] = self.store[is_public].pop(old_file_id)
        return f"{'public' if is_public else 'private'}/{new_file_id}"
    def delete_file(self, file_id: str, is_public=False):
        if file_id in self.store[is_public]:
            del self.store[is_public][file_id]
            return True
        return False
    def toggle_share(self, file_id: str, current_is_public: bool):
        data = self.store[current_is_public].pop(file_id)
        new_pub = not current_is_public
        self.store[new_pub][file_id] = data
        return (f"{'public' if new_pub else 'private'}/{file_id}", new_pub)
    def get_file_info(self, file_id: str, is_public=False):
        data = self.store[is_public][file_id]
        return {"size": len(data), "content_type": None, "created": None, "updated": None}


@pytest.fixture(autouse=True)
def patch_gcs(monkeypatch):
    from backend.services import gcs_service as gcs_mod
    gcs_mod.gcs_service = FakeGCS()
    yield


def test_file_upload_list_download_delete(app_client):
    # List empty
    r0 = app_client.get("/api/files/")
    assert r0.status_code == 200
    dec0 = EncryptionService.decrypt_data(r0.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert dec0["files"] == []

    # Upload
    data = b"hello"
    r1 = app_client.post("/api/files/upload", files={"file": ("hello.txt", data)})
    assert r1.status_code == 200
    dec1 = EncryptionService.decrypt_data(r1.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    fid = dec1["file_id"]

    # List non-empty
    r2 = app_client.get("/api/files/")
    dec2 = EncryptionService.decrypt_data(r2.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert any(item["file_id"] == fid for item in dec2["files"])

    # Info
    r3 = app_client.get(f"/api/files/{fid}")
    dec3 = EncryptionService.decrypt_data(r3.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert dec3["size"] == len(data)

    # Download
    r4 = app_client.get(f"/api/files/{fid}/download")
    assert r4.status_code == 200
    assert r4.content == data

    # Rename
    r5 = app_client.patch(f"/api/files/{fid}", data={"new_file_id": "newid", "public": "false"})
    assert r5.status_code == 200
    dec5 = EncryptionService.decrypt_data(r5.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert dec5["file_id"] == "newid"

    # Toggle share
    r6 = app_client.post(f"/api/files/newid/toggle-share", data={"current_public": "false"})
    assert r6.status_code == 200
    dec6 = EncryptionService.decrypt_data(r6.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert dec6["is_public"] is True

    # Public download via site route
    r6b = app_client.get(f"/api/files/public/newid")
    assert r6b.status_code == 200
    assert r6b.content == data

    # Delete
    r7 = app_client.delete("/api/files/newid")
    assert r7.status_code == 200
    dec7 = EncryptionService.decrypt_data(r7.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert dec7["success"] is True
