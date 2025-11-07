# Unified GCP App — Combined Documentation

This README aggregates the core documentation at the repository root for quick access and shared context.

- PRD: product scope, goals, constraints
- Design: architecture and technical decisions
- Plan: phased rollout steps
- Agents: working agreements and guardrails

---

## Table of Contents
- [PRD](#prd)
- [Design](#design)
- [Plan](#plan)
- [Agents](#agents)
 - [Frontend Routes](#frontend-routes)

---

## PRD

[Source: PRD.md]

```text
<<BEGIN PRD.md>>
***
# Unified GCP App — Product Requirements (PRD)

## Overview

Unify three FastAPI-based projects into a single product:
- chatai-gcp: Encrypted chat assistant with JWT auth and React + Tailwind frontend.
- note-gcp: Encrypted notes creation/editing/storage.
- cache-gcp: File cache/transfer to Google Cloud Storage (GCS) with public/private sharing.

Single deployment target: Google App Engine (Standard, Python 3.13). Frontend: React + Tailwind. Backend: FastAPI. Authentication and encryption must remain identical to chatai-gcp (JWT HS256; AES-GCM using server-side `AES_KEY_HASH`; frontend key presence in `localStorage` as `aes_key_hash`).

## Goals
- One codebase and service exposing Chat, Notes, and File Cache features.
- Preserve chatai-gcp authentication and encryption semantics without changes.
- Minimal friction App Engine deploy with static React served by GAE handlers and FastAPI for APIs.
- Clear, typed API surface; consistent response envelopes and error handling.

## Users & Personas
- Admin/single-tenant operator authenticating with configured credentials (`USERNAME`, `PASSWORD_HASH`).
- Technical end users accessing chat, notes, and file tools after login.

## In-Scope Features
- Authentication
  - Login via JWT (HS256) with access/refresh tokens.
  - Protected API routes using bearer tokens.
- Encryption
  - AES-GCM for request/response encryption where required.
  - Frontend uses `localStorage.aes_key_hash` to enable encryption.
  - Server key derivation from `AES_KEY_HASH` (first 32 chars; SHA-256-derived key for AESGCM operations).
- Chat (from chatai-gcp)
  - Create conversations, stream encrypted responses, list/history, model selection.
- Notes (from note-gcp, aligned to chatai encryption/auth)
  - Create/edit/view/list notes; encrypt at rest and in transit.
- File Cache (from cache-gcp, aligned to chatai encryption/auth)
  - Upload from file or URL, list, rename, delete, download, toggle public/private; backed by GCS.

## Non-Functional Requirements
- Deployment: App Engine standard, single service; F1 instance class default; autoscaling minimal cost.
- Reliability: Basic error handling and input validation; idempotent reads; safe writes.
- Security: JWT validation; rate limits via env; CORS restricted; no secrets in logs.
- Performance: Sub-200ms p50 for simple reads; streaming for chat.
- Observability: Structured logs; basic health endpoint.

## Constraints & Assumptions
- Keep chatai-gcp auth and encryption unchanged; other modules must adapt to it.
- Frontend is React + Tailwind; no SSR.
- Storage
  - Chat/notes metadata in Firestore (as in chatai-gcp), or retained per existing service where practical.
  - File cache content in GCS (bucket configured via env).
- Single App Engine service for simplicity (multi-service out-of-scope initially).

## Success Criteria
- A single deployed service on GAE with:
  - Login works; JWT-protected endpoints enforce auth.
  - Encryption active when `aes_key_hash` is present; endpoints decrypt/encrypt correctly.
  - Chat features function with streaming.
  - Notes CRUD works with encryption at rest and in transit.
  - File cache upload/list/download/share works against configured GCS bucket.

## Out of Scope (v1)
- Multi-user registration/roles; OAuth/OIDC.
- Complex RBAC or per-object ACL beyond public/private toggle for files.
- Advanced audit logging/metrics dashboards.
- Multi-region deployment, blue/green.

## High-Level API (summary)
- Auth: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- Chat: `/api/chat`, `/api/conversations` (existing chatai-gcp contract; encrypted as configured).
- Notes: `/api/notes` (CRUD; responses encrypted when enabled).
- Files: `/api/files` (list, upload, rename, delete, download, share toggle; encryption rules documented in Design).

## Risks
- Divergent encryption conventions in note-gcp and cache-gcp; mitigation: standardize to chatai-gcp (`encrypted_data`).
- App Engine handler routing collisions; mitigation: clear handler ordering and unified build output paths.
- GCS and Firestore permissions in production; mitigation: least-privilege service account and explicit env documentation.
***
<<END PRD.md>>
```

---

## Design

[Source: DESIGN.md]

```text
<<BEGIN DESIGN.md>>
***
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
  - Add routes/views: `/` (Portal), `/chat`, `/note`, `/file`, `/setting` with pages and components
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
  - `/` (Portal), `/chat`, `/note`, `/file`, `/setting`.
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
***
<<END DESIGN.md>>
```

---

## Plan

[Source: PLAN.md]

```text
<<BEGIN PLAN.md>>
***
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
- Phase 3 — Frontend Integration
  - Add routes/pages for Notes and Files; reuse chatai contexts and encryption service.
  - Implement API clients for notes/files.
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
***
<<END PLAN.md>>
```

---

## Agents

[Source: AGENTS.md]

```text
<<BEGIN AGENTS.md>>
***
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
***
<<END AGENTS.md>>
```


## Frontend Routes
- `/` Portal: landing with links to Chat, Notes, Files, Settings.
- `/chat`: chat tool (unchanged logic, mounted here).
- `/note`: notes tool (minimal editor using encryptionService).
- `/file`: files tool (list/upload scaffolding, rename/delete/download/share).
- `/setting`: manage `localStorage.aes_key_hash` and sign out.
- Unknown paths redirect to `/`.
