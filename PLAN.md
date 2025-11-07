# Unified GCP App — Implementation Plan

## Phases
- Phase 0 — Alignment & Setup
  - Confirm scope, constraints, and environment variables.
  - Approve repo layout and App Engine deploy approach.
- Phase 1 — Monorepo Consolidation
  - Use `chatai-gcp` as base; copy/merge into root `backend/` and `frontend/`.
  - Move `app.yaml` to root; configure static handlers and `entrypoint`.
- Phase 2 — Backend Integration
  - Add `routers/notes.py` from note-gcp; adapt to chatai auth/encryption.
  - Add `routers/files.py` from cache-gcp; adapt to chatai auth/encryption; wrap GCS ops.
  - Extend `encryption_middleware` endpoints to include notes/files where applicable.
  - Wire services (`firestore_service`, new `gcs_service`).
– Phase 3 – Frontend Integration
  - Split UI into first-level paths: `/` Portal, `/chat`, `/note`, `/file`, `/setting`.
  - Mount existing chat under `/chat`; scaffold minimal Notes/Files pages; add Settings for AES key management.
  - Implement/extend API clients for notes/files.
- Phase 4 — App Engine Deployment
  - Build frontend: `npm ci && npm run build`.
  - Deploy with `gcloud app deploy` using root `app.yaml`.
  - Verify handlers and API routing.
- Phase 5 — QA & Hardening
  - Unit/integration tests for routers/services.
  - Load test critical endpoints; verify encryption on/off behavior.
  - Review IAM for Firestore and GCS; finalize envs.

## Milestones & Deliverables
- M0: PRD/DESIGN/PLAN/AGENTS approved.
- M1: Monorepo structure in place; builds locally.
- M2: Backend routes for notes/files functional with encryption/auth.
- M3: Frontend pages integrated; e2e flows pass.
- M4: GAE deploy green; smoke tests pass.

## Environment Variables (consolidated)
- Auth: `JWT_SECRET_KEY`, `USERNAME`, `PASSWORD_HASH`, `JWT_ACCESS_EXPIRE_MINUTES`, `JWT_REFRESH_EXPIRE_DAYS`.
- Encryption: `AES_KEY_HASH`.
- GCP: `GOOGLE_CLOUD_PROJECT`, `GCS_BUCKET`.
- Optional: `AUTH_RATE_LIMIT`, `CHAT_RATE_LIMIT`, `DEBUG`.

## Rollback Plan
- Keep current individual services untouched until unified app is live.
- If unified deploy fails, rollback by switching traffic back to prior services (if applicable) or redeploy previous version in GAE.

## Open Items for Approval
- Persist file metadata in Firestore (Y/N) vs rely on GCS listing only.
- Notes data model minimal fields (title, encrypted content) vs additional tags.
- Exact set of endpoints to be covered by encryption for files (metadata vs raw download JSON only).
