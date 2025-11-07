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
- Navigation
  - Portal landing page at `/` to select tools (Chat, Notes, Files).
  - Settings page at `/setting` to manage `localStorage.aes_key_hash` (no change to encryption scheme).
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

## Frontend Routes (summary)
- `/` Portal, `/chat`, `/note`, `/file`, `/setting` (unknown paths redirect to `/`).

## Risks
- Divergent encryption conventions in note-gcp and cache-gcp; mitigation: standardize to chatai-gcp (`encrypted_data`).
- App Engine handler routing collisions; mitigation: clear handler ordering and unified build output paths.
- GCS and Firestore permissions in production; mitigation: least-privilege service account and explicit env documentation.
