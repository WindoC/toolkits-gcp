# Testing and Debugging Guide

## Local Setup
- Backend
  - Create and activate a virtualenv in `.venv`:
    - Windows (PowerShell):
      - `python -m venv .venv`
      - `.\.venv\Scripts\Activate.ps1`
    - macOS/Linux:
      - `python3 -m venv .venv`
      - `source .venv/bin/activate`
    - Upgrade pip and install deps:
      - `python -m pip install --upgrade pip`
      - `pip install -r backend/requirements.txt`
  - Set required env vars (for local dev, minimal values):
    - `JWT_SECRET_KEY=devsecret`
    - `USERNAME=admin`
    - `PASSWORD_HASH=<sha256 of your password>`
    - `AES_KEY_HASH=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` (>=32 chars)
    - `GOOGLE_CLOUD_PROJECT=local-dev` (no real GCP access needed if using mocks)
    - Optionally: `GCS_BUCKET=dev-bucket`
  - Run backend: `PYTHONPATH=backend python -m uvicorn backend.main:app --reload`
- Frontend
  - `cd frontend && npm ci && npm start`

## Running Tests
- Run all tests: `PYTHONPATH=backend pytest -q`
- Run a single test file: `PYTHONPATH=backend pytest backend/tests/test_notes.py -q`
- Show logs during tests: `pytest -q -s`

Notes
- Tests patch Firestore and GCS to avoid real cloud access.
- Encryption-dependent endpoints use a test `AES_KEY_HASH`; tests encrypt/decrypt payloads accordingly.
- Auth is overridden in tests to simulate a logged-in user.

## Debugging Tips
- To inspect middleware encryption, set `AES_KEY_HASH` and call endpoints with `{ "encrypted_data": "..." }` request bodies; responses include `encrypted_data`.
- Use `/health` and `/` to confirm the server is running.
- Enable debug logging by setting `DEBUG=true` and using a verbose uvicorn run.

## Common Issues
- 401 Unauthorized: Include `Authorization: Bearer <access_token>` in non-test calls or rely on test overrides.
- Encryption errors: Ensure `AES_KEY_HASH` is set and client uses the same key for AES-GCM.
- Firestore/GCS errors: In tests, these are mocked; in real runs provide valid GCP credentials and project.
