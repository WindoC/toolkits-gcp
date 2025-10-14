# Deployment Guide (Google App Engine)

## Prerequisites
- Google Cloud project with billing enabled.
- gcloud CLI installed and authenticated: `gcloud auth login` and `gcloud config set project <PROJECT_ID>`.
- App Engine app created (once): `gcloud app create --region=<REGION>`.
- Bucket created for file cache if needed: `gsutil mb -p <PROJECT_ID> gs://<BUCKET_NAME>`.

## Configure Environment Variables
Set these in App Engine (recommended via `app.yaml` env_variables with placeholders replaced in Console, or using `gcloud app deploy --no-promote` after editing locally):
- `JWT_SECRET_KEY`: long random string
- `USERNAME`: admin username
- `PASSWORD_HASH`: SHA-256 of your admin password
- `AES_KEY_HASH`: frontend AES key hash (>=32 chars)
- `GOOGLE_CLOUD_PROJECT`: your project id
- `GCS_BUCKET`: your GCS bucket name
- Optional: `AUTH_RATE_LIMIT`, `CHAT_RATE_LIMIT`, `DEBUG`

## Build Frontend
- `cd frontend`
- `npm ci`
- `npm run build`
- Ensure `frontend/build` exists (GAE static handlers serve this).

## Deploy
- From repo root (where `app.yaml` resides):
- `gcloud app deploy`
- Confirm region and service settings when prompted.
- Open the app: `gcloud app browse`.

## Post-Deploy Checks
- `/health` returns status healthy.
- Login via `/login` in the React app; verify JWT flow.
- Set `localStorage.aes_key_hash` in browser to match `AES_KEY_HASH` then test encrypted endpoints (chat/notes).
- Verify GCS file operations (list/upload/download) using configured bucket.

## Rollback
- List versions: `gcloud app versions list`
- Migrate traffic back: `gcloud app services set-traffic default --splits <VERSION>=1`
- Or delete a broken version: `gcloud app versions delete <VERSION>`

## Troubleshooting
- 500 on encrypted endpoints: ensure `AES_KEY_HASH` is set.
- 401s: confirm env vars for auth and use correct credentials.
- GCS errors: verify `GCS_BUCKET` and service account permissions (Storage Object Admin minimum for the bucket).
- Firestore errors: check Firestore is enabled and service account has access; database id `(default)`.

## Local Testing With GCP
- Service account and authentication
  - Create a service account with minimal roles:
    - Firestore User (or Datastore User) for database access
    - Storage Object Admin (or narrower: Storage Object Creator + Viewer) for the bucket
  - Download a JSON key and set `GOOGLE_APPLICATION_CREDENTIALS` to its path:
    - Windows (PowerShell): `setx GOOGLE_APPLICATION_CREDENTIALS C:\path\to\key.json`
    - macOS/Linux: `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`
- Environment setup
  - `export GOOGLE_CLOUD_PROJECT=<PROJECT_ID>` (or set in `.env`)
  - `export GCS_BUCKET=<BUCKET_NAME>`
  - `export JWT_SECRET_KEY=<secret>`
  - `export USERNAME=<admin>` and `export PASSWORD_HASH=<sha256-of-password>`
  - `export AES_KEY_HASH=<at-least-32-chars>`
- Backend run
  - Create and activate `.venv` (see TEST.md), then:
  - `pip install -r backend/requirements.txt`
  - `PYTHONPATH=backend python -m uvicorn backend.main:app --reload`
- Smoke tests (examples)
  - Health: `curl http://localhost:8000/health`
  - Login: `POST /auth/login` with `{ "username": "<admin>", "password": "<pwd>" }`
  - Set `localStorage.aes_key_hash` in your browser DevTools to match `AES_KEY_HASH`
  - Notes:
    - Create (encrypted): `POST /api/notes/` body `{ encrypted_data: <ENC> }`
    - Get/List: `GET /api/notes/{id}` / `GET /api/notes/` (responses are encrypted)
  - Files:
    - Upload: `POST /api/files/upload` with multipart `file`
    - List: `GET /api/files/`
    - Download: `GET /api/files/{id}/download`
