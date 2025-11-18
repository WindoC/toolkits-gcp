import pytest
from backend.services.encryption_service import EncryptionService


def _enc_body(payload: dict) -> dict:
    key = EncryptionService.get_server_encryption_key()
    return {"encrypted_data": EncryptionService.encrypt_data(payload, key)}


class DummyDoc:
    def __init__(self, store, note_id):
        self.store = store
        self.note_id = note_id
    def set(self, data):
        self.store[self.note_id] = data
    def update(self, updates):
        self.store[self.note_id].update(updates)
    def get(self):
        class _R:
            def __init__(self, d):
                self._d = d
                self.exists = d is not None
            def to_dict(self):
                return self._d
        return _R(self.store.get(self.note_id))
    def delete(self):
        self.store.pop(self.note_id, None)


class DummyCol:
    def __init__(self, store):
        self.store = store
    def document(self, note_id):
        return DummyDoc(self.store, note_id)
    def where(self, field, op, value):
        class _Q:
            def __init__(self, store, owner):
                self.store = store
                self.owner = owner
            def stream(self):
                for note in self.store.values():
                    if note.get("owner") == self.owner:
                        class _D:
                            def __init__(self, data):
                                self._d = data
                            def to_dict(self):
                                return self._d
                        yield _D(note)
        return _Q(self.store, value)


class DummyDB:
    def __init__(self):
        self.store = {}
    def collection(self, name):
        return DummyCol(self.store)


@pytest.fixture(autouse=True)
def patch_notes_fs(monkeypatch):
    from backend.routers import notes as notes_router
    class _FS:
        def __init__(self):
            self.db = DummyDB()
    fs_inst = _FS()
    monkeypatch.setattr(notes_router, "get_fs", lambda: fs_inst)
    yield


def test_create_and_get_note(app_client):
    # Create note
    resp = app_client.post("/api/notes/", json=_enc_body({"title": "T1", "content": "Hello"}))
    assert resp.status_code == 201
    body = resp.json()
    # Response is encrypted by middleware: decrypt
    decrypted = EncryptionService.decrypt_data(body["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert decrypted["title"] == "T1"
    assert decrypted["content"] == "Hello"
    note_id = decrypted["note_id"]

    # Get note
    resp2 = app_client.get(f"/api/notes/{note_id}")
    assert resp2.status_code == 200
    dec2 = EncryptionService.decrypt_data(resp2.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert dec2["title"] == "T1"
    assert dec2["content"] == "Hello"


def test_list_and_update_and_delete_note(app_client):
    # Create a note
    r = app_client.post("/api/notes/", json=_enc_body({"title": "X", "content": "A"}))
    note_id = EncryptionService.decrypt_data(r.json()["encrypted_data"], EncryptionService.get_server_encryption_key())["note_id"]

    # List notes
    rl = app_client.get("/api/notes/")
    dec_list = EncryptionService.decrypt_data(rl.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert isinstance(dec_list, list)
    assert any(n["title"] == "X" for n in dec_list)

    # Update title and content
    ru = app_client.put(f"/api/notes/{note_id}", json=_enc_body({"title": "Y", "content": "B"}))
    dec_u = EncryptionService.decrypt_data(ru.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert dec_u["title"] == "Y"
    assert dec_u["content"] == "B"

    # Delete
    rd = app_client.delete(f"/api/notes/{note_id}")
    dec_d = EncryptionService.decrypt_data(rd.json()["encrypted_data"], EncryptionService.get_server_encryption_key())
    assert dec_d["success"] is True


def test_search_notes_by_query(app_client):
    # Create notes with distinct content
    app_client.post("/api/notes/", json=_enc_body({"title": "Alpha note", "content": "First body"}))
    app_client.post("/api/notes/", json=_enc_body({"title": "SearchTarget note", "content": "Contains special keyword"}))

    # Search using query parameter (backend-side filtering)
    resp = app_client.get("/api/notes/?q=SearchTarget")
    assert resp.status_code == 200
    dec_list = EncryptionService.decrypt_data(resp.json()["encrypted_data"], EncryptionService.get_server_encryption_key())

    assert isinstance(dec_list, list)
    assert any("searchtarget" in (n.get("title") or "").lower() or "searchtarget" in (n.get("content") or "").lower() for n in dec_list)
