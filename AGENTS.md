# AGENTS — Guidance for Automated Changes

Scope: Entire repository.

## Principles
- Preserve authentication and encryption logic from chatai-gcp without modification.
- Favor minimal, targeted changes aligned to the Design and Plan.
- Keep API contracts consistent and typed. Do not break existing chatai endpoints.
- Prefer simplicity over premature abstraction.

## Repository Structure (target)
- `backend/`: FastAPI app (rooted from chatai-gcp/backend)
  - `routers/`: add `notes.py`, `files.py` (adapted from note-gcp and cache-gcp)
  - `services/`: keep existing; add `gcs_service.py` adapter
  - `middleware/`: keep as-is; update encrypted endpoints list only
  - `config.py`, `main.py`, `models.py` remain central
- `frontend/`: React + Tailwind (from chatai-gcp/frontend)
  - Add pages/routes for Notes and Files, reusing `AuthContext` and `encryptionService`
- `app.yaml`: single App Engine service serving React static and FastAPI app

## Invariants (do not change)
- Auth: JWT HS256, env-driven (`JWT_SECRET_KEY`, `USERNAME`, `PASSWORD_HASH`).
- Encryption: AES-GCM; server key derived from `AES_KEY_HASH`; frontend key via `localStorage.aes_key_hash`.
- Wire format: encrypted payload key is `encrypted_data` for requests/responses.
- SSE responses must remain unencrypted (middleware must bypass `text/event-stream`).

## Coding Conventions
- Python: follow existing project style; type hints where present; clear function names; no one-letter vars.
- React/TS: functional components, hooks; extend existing patterns for services and contexts; Tailwind for styling.
- Tests: add or update adjacent unit tests when modifying routers/services. Keep tests fast and focused.

## Operational Notes
- Environment variables required at deploy time:
  - Auth: `JWT_SECRET_KEY`, `USERNAME`, `PASSWORD_HASH`, `JWT_ACCESS_EXPIRE_MINUTES`, `JWT_REFRESH_EXPIRE_DAYS`
  - Encryption: `AES_KEY_HASH`
  - GCP: `GOOGLE_CLOUD_PROJECT`, `GCS_BUCKET`
- App Engine deploy expects `frontend/build` to exist; build via `npm ci && npm run build` before `gcloud app deploy`.

## References
- Combined docs index: `README.md:1`
- PRD: `PRD.md:1`
- Design: `DESIGN.md:1`
- Plan: `PLAN.md:1`

## Do Nots
- Do not switch to a different auth provider or encryption scheme.
- Do not expose secrets in code or logs. Use env vars.
- Do not encrypt SSE responses.
- Do not introduce breaking changes to existing chatai-gcp API routes.

## How to Work Locally
- Backend: `uvicorn backend.main:app --reload`
- Frontend: `npm start` in `frontend`, with API base configured to local backend.
- Lint/format: follow existing project scripts; do not introduce new toolchains unless required.

## Change Process
- Before large refactors, update DESIGN.md and PLAN.md.
- Keep changes small and reviewable; align with phases in PLAN.md.
- Validate with targeted tests and manual checks where applicable.

## Open Decisions (await confirmation)
- Persist file metadata in Firestore (Y/N) vs rely on GCS listing only.
- Notes data model: minimal (title, encrypted content) vs additional tags/fields.
- Encryption coverage for file endpoints: which endpoints return encrypted JSON metadata vs raw bytes.
