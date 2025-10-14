# Unified GCP App — Technical Design

## Architecture Overview
- Monorepo with single App Engine service.
- Backend: FastAPI (Python 3.13), based on `chatai-gcp/backend`.
- Frontend: React + Tailwind, based on `chatai-gcp/frontend`.
- Integrate note-gcp and cache-gcp features as new FastAPI routers and React routes/pages.
- Serve React build via GAE static handlers; proxy API/auth to FastAPI via `script: auto`.

## Proposed Repository Layout
- `backend/` (from chatai-gcp/backend)
  - `routers/` (existing): `auth.py`, `chat.py`, `conversations.py`, `models.py`
  - `routers/notes.py` (new): CRUD for notes (adapted from note-gcp)
  - `routers/files.py` (new): File operations (adapted from cache-gcp)
  - `services/`: keep chatai services; add `gcs_service.py` adapter consuming cache-gcp GCS client logic
  - `middleware/`: keep `auth_middleware.py`, `encryption_middleware.py` and extend encrypted endpoints list
  - `models.py`, `config.py`, `main.py` stay as central entry
- `frontend/` (from chatai-gcp/frontend)
  - Add routes/views: `/notes`, `/files` with pages and components
  - Reuse `AuthContext`, `encryptionService`, and API client patterns
- `app.yaml` (root): copied/extended from chatai-gcp with static handlers for React build
- `.gcloudignore`, `.gitignore` (root)

## Authentication & Encryption (Must Remain As-Is)
- Auth: JWT HS256 using `JWT_SECRET_KEY`, `USERNAME`, `PASSWORD_HASH`.
- Encryption: AES-GCM server-side using `AES_KEY_HASH` (frontend stores `aes_key_hash` in `localStorage`).
- Middleware: `encryption_middleware` encrypts responses and decrypts payloads for designated endpoints.
- Standardize on chatai-gcp wire format `{"encrypted_data": "..."}`.
  - Migration:
    - note-gcp: previously used `AES_KEY` direct; now align to `AES_KEY_HASH` deriviation and `encrypted_data` field.
    - cache-gcp: previously `encrypted_payload`; change to `encrypted_data` and AES-GCM key derivation per chatai.

## Backend Design
- Routers
  - `GET/POST /api/notes`, `GET/PUT/DELETE /api/notes/{id}`
  - `GET/POST /api/files`, `POST /api/files/upload`, `GET /api/files/{id}`, `PATCH /api/files/{id}`, `DELETE /api/files/{id}`
  - `POST /api/files/{id}/toggle-share` toggles public/private
- Middleware
  - Update `EncryptionMiddleware.ENCRYPTED_ENDPOINTS` to include `/api/notes` and `/api/files` reads (and any payload writes) as appropriate.
  - Chat and conversations remain encrypted endpoints.
- Services
  - `firestore_service.py`: reuse for chat/notes metadata.
  - `gcs_service.py`: new adapter wrapping GCS operations from cache-gcp (`upload_from_file`, `upload_from_url`, `download_file`, `list_files`, `rename_file`, `delete_file`, `toggle_share`).
- Data Models
  - Notes: `{ id, title, content_encrypted, created_at, updated_at, owner }` (store encrypted content field in Firestore)
  - Files: metadata in Firestore optional; primary storage in GCS under `private/` or `public/` prefixes.

## Frontend Design
- Global
  - Reuse auth flow (Login, token refresh), `AuthContext`, and `encryptionService` from chatai-gcp.
  - Tailwind config from chatai-gcp is kept.
- Routes
  - `/chat` (existing), `/notes`, `/files`, `/login`.
- Notes UI
  - List, editor, preview (migrate templates from note-gcp into React components).
- Files UI
  - List with size/visibility, upload (file and URL), rename, delete, download, toggle share.
- API Client
  - Extend existing `api.ts` with notes/files endpoints.
  - All supported endpoints to use `encryptionService` for request/response when available.

## Deployment
- App Engine Standard, Python 3.13.
- `entrypoint` runs uvicorn in `backend` directory.
- Static handlers serve `frontend/build` assets and `index.html` for client routes.
- Environment variables (set in GCP Console):
  - Auth: `JWT_SECRET_KEY`, `USERNAME`, `PASSWORD_HASH`, `JWT_ACCESS_EXPIRE_MINUTES`, `JWT_REFRESH_EXPIRE_DAYS`.
  - Encryption: `AES_KEY_HASH`.
  - GCP: `GOOGLE_CLOUD_PROJECT`, `GCS_BUCKET`.
  - Optional rate limits: `AUTH_RATE_LIMIT`, `CHAT_RATE_LIMIT`.

## Compatibility & Migration Notes
- Unify encryption payload key to `encrypted_data`.
- Ensure `encryption_middleware` does not wrap SSE (`text/event-stream`).
- File downloads: return raw bytes responses; for endpoints that return JSON metadata, keep encryption consistent.
- CORS: restrict to known origins; same origin recommended in GAE setup.

## Testing Strategy
- Unit
  - Services: encryption, auth, firestore, GCS adapter.
  - Routers: happy-path and error-path tests for notes/files.
- Integration
  - Login + encrypted calls for chat/notes/files.
- E2E (optional)
  - Frontend flows for login, chat message, note create/view, file upload/download.

## Open Questions
- Persist file metadata in Firestore or infer from GCS only? (Default: no metadata DB, list via GCS.)
- Notes search/indexing scope (out of scope for v1).
- Multi-service split for heavy traffic (future phase).

