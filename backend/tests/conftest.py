import os
import hashlib
import importlib
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def test_env():
    os.environ.setdefault("JWT_SECRET_KEY", "devsecret")
    os.environ.setdefault("USERNAME", "admin")
    # sha256('password')
    os.environ.setdefault("PASSWORD_HASH", hashlib.sha256(b"password").hexdigest())
    os.environ.setdefault("AES_KEY_HASH", "a" * 40)
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "local-dev")
    yield


@pytest.fixture()
def app_client(test_env):
    # Patch Firestore client to avoid real GCP calls during import
    class _DummyDoc:
        def set(self, *a, **k):
            return None
        def update(self, *a, **k):
            return None
        def get(self):
            class _R: exists = False
            return _R()
        def delete(self):
            return None

    class _DummyCol:
        def document(self, *a, **k):
            return _DummyDoc()
        def where(self, *a, **k):
            class _Q:
                def stream(self):
                    return []
            return _Q()

    class _DummyDB:
        def collection(self, *a, **k):
            return _DummyCol()

    class _DummyClient:
        def __init__(self, *a, **k):
            pass

    with patch("google.cloud.firestore.Client", _DummyClient):
        # Import app after patch
        from backend import main as backend_main
        # Monkeypatch the global firestore_service db to dummy
        try:
            from backend.services import firestore_service as fs_mod
            fs_mod.firestore_service.db = _DummyDB()
        except Exception:
            pass

        # Override auth dependency for tests
        from backend.middleware.auth_middleware import get_current_user
        from backend.services.auth_service import TokenData
        backend_main.app.dependency_overrides[get_current_user] = lambda: TokenData(username="tester")

        yield TestClient(backend_main.app)

