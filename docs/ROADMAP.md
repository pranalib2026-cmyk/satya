# NyayaSetu Roadmap

> Consolidated from: `docs/ROADMAP.md`, `docs/ROADMAP.md`, `docs/ROADMAP.md`.


---

## Roadmap (Canonical)

# Roadmap

This roadmap reflects the repository as of November 2026. It separates what is
already working from what is planned. Adjust sequencing with the product owner;
do not treat unchecked items as implemented.

## Guiding constraints

- Local development must stay simple: no Docker requirement for the default path.
- The backend remains the content source of truth once integration begins.
- Compliance copy ships with the product, not after it.
- No feature may imply an advocate-client relationship or guaranteed outcome.
- PostgreSQL 16 (with PostGIS and pgvector) is the database target; SQLite is used for the in-memory test harness.

---

## Phase 0 — Foundation (done)

- [x] Next.js 16 frontend with App Router, Tailwind 4, Framer Motion, Three.js.
- [x] India-focused marketing pages and editorial design system.
- [x] Python 3.12 + FastAPI 0.115 Modular Monolith backend.
- [x] Pydantic v2 validation and typed request/response schemas.
- [x] SQLAlchemy 2.0 async engine with PostgreSQL 16, PostGIS, and pgvector.
- [x] Alembic migration environment with 8 applied revisions.
- [x] Seed data for Bare Acts (NI Act, CPA 2019, RERA, BNSS, Legal Services Authorities Act).
- [x] Grounded Legal AI Assistant with pgvector semantic retrieval and citation validation.
- [x] Deterministic legal triage matrix and case intake reference tracking.
- [x] Multi-factor advocate matching under Bar Council of India Rule 36.
- [x] Argon2id password hashing and PyJWT authentication with refresh token rotation.
- [x] Evidence document vault with SHA-256 validation and 15-minute signed download tokens.
- [x] Limitation Act 1963 statutory deadline tracking and advocate review confirmations.
- [x] Consultation appointments booking with conflict detection and RFC 5545 `.ics` export.
- [x] Pytest async integration test suite (79 passing tests).
- [x] Architecture, API contract, database schema, and agent verification documentation.

---

## Phase 1 — Connect frontend to API (next)

### 1.1 API client and configuration

- [ ] Add `NEXT_PUBLIC_API_URL` (or a server-only equivalent) and document it.
- [ ] Create `frontend/src/lib/api.ts` with typed envelope parsing and errors.
- [ ] Decide cache/revalidation policy per endpoint.
- [ ] Add a shared error boundary/fallback for API failures.

### 1.2 Read-path migration

- [ ] `/site` → navbar, footer, contact, and legal notices.
- [ ] `/practices` → home slider and practices page.
- [ ] `/advocates` → people page, including pagination/filter wiring.
- [ ] `/matters` + `/matters/categories` → matters page.
- [ ] `/insights` + `/insights/categories` → insights index and detail.
- [ ] `/catalog` → FAQs, testimonials, fixed-fee section.
- [ ] Remove static arrays only after every consumer is migrated.

### 1.3 Write-path migration

- [ ] `/contact` form → `POST /api/v1/intake` (`kind: "conflict-check"` or
      `legal-assessment`).
- [ ] Home conflict section → same endpoint.
- [ ] Quick consultation modal → `kind: "consultation"` with preferred slot.
- [ ] Display returned `reference`, `nextStep`, and `trackingUrl`.
- [ ] Map server validation errors to form fields.
- [ ] Handle `429` with a clear retry message.
- [ ] `/insights` newsletter form → `POST /api/v1/newsletter`; remove the
      simulated success.

### 1.4 Content cleanup

- [ ] Complete the P0 items in [`CONTENT.md`](CONTENT.md).
- [ ] Replace USD fixed-fee packages with approved INR content or hide them.
- [ ] Fix sitemap base URL, metadata, and not-found copy.
- [ ] Rename the frontend package and remove legacy CSS comments.
- [ ] Align insight categories between data, tabs, and API.

### 1.5 Quality

- [ ] Add frontend tests for intake mapping and form validation.
- [ ] Add a smoke test or Playwright flow for intake submission.
- [ ] Add API response schemas so OpenAPI includes response shapes.
- [ ] Add an OpenAPI example generation check to CI.

**Exit criteria:** the public site reads content from the API, all forms create
real records, and no user-facing legacy firm copy remains.

---

## Phase 2 — Operations and admin

### 2.1 Authentication and authorization

- [ ] Choose an auth approach (session cookies or JWT with refresh).
- [ ] Add `users`, `roles`, and optional `organizations` tables.
- [ ] Protect admin routes; keep public content routes open.
- [ ] Add rate limits and audit logs for privileged actions.
- [ ] Add CSRF protection if using cookies.

### 2.2 Intake operations

- [ ] Admin list/detail endpoints with filters by kind, status, urgency, date.
- [ ] Status transitions (`received` → `in-review` → `matched` → `closed` /
      `rejected`) with `updatedAt` writes and an audit trail.
- [ ] Internal notes separate from client-visible fields.
- [ ] Assignment to an advocate or intake counsel.
- [ ] Retention policy and deletion/anonymization job.
- [ ] Export for the conflicts desk.

### 2.3 Content management

- [ ] Admin CRUD for practices, advocates, matters, insights, FAQs,
      testimonials, and fees.
- [ ] Draft/publish workflow and slug uniqueness checks.
- [ ] Image upload or validated external URL fields.
- [ ] Preview support for the frontend.

### 2.4 Notifications

- [ ] Transactional email provider adapter.
- [ ] Outbox table with retries and idempotency keys.
- [ ] Intake acknowledgement and status-change emails.
- [ ] Newsletter double opt-in and unsubscribe endpoint.
- [ ] Optional WhatsApp notification provider.

**Exit criteria:** staff can process intake end-to-end without direct database
access, and every notification is retry-safe.

---

## Phase 3 — Production hardening

### 3.1 PostgreSQL

- [ ] Add PostgreSQL driver and convert schema.
- [ ] Regenerate migrations for PostgreSQL.
- [ ] Normalize JSON filters (languages, partner ids, practice links).
- [ ] Add connection pooling and health checks.
- [ ] Backfill or reseed production data.
- [ ] Document the migration runbook.

### 3.2 Deployment

- [ ] Container image or Node build pipeline for the API.
- [ ] Frontend deployment with environment-specific API URL.
- [ ] Managed secrets; no `.env` in images.
- [ ] TLS reverse proxy, request size limits, and access logs.
- [ ] Migration release step before process start.
- [ ] Backups and restore drill.
- [ ] Staging environment with seeded non-production data.

### 3.3 Observability and reliability

- [ ] Error tracking (for example Sentry) for both apps.
- [ ] Request latency and error-rate metrics.
- [ ] Structured audit logs for admin actions.
- [ ] Alerting on readiness failures and 5xx spikes.
- [ ] Graceful shutdown verified under load.
- [ ] Load test the public read endpoints.

### 3.4 Security and privacy

- [ ] Threat model for intake, admin, and notifications.
- [ ] PII inventory and retention schedule (India DPDP Act alignment).
- [ ] Data deletion and access-request procedures.
- [ ] Dependency and container scanning in CI.
- [ ] Penetration test before public launch.
- [ ] Privacy policy reviewed by counsel.

**Exit criteria:** the API runs on PostgreSQL behind TLS, has backups, alerts,
audit logs, and a documented incident/retention process.

---

## Phase 4 — Product expansion

### 4.1 Preliminary assessment

- [ ] Define the assessment input and output contract.
- [ ] Add an `assessments` table and status lifecycle.
- [ ] Integrate an LLM provider behind a server-side adapter.
- [ ] Add prompt/version tracking, safety filters, and human review.
- [ ] Return "information, not advice" with citations and next steps.
- [ ] Never persist sensitive free text longer than necessary.

### 4.2 Advocate matching

- [ ] Normalize practice, language, jurisdiction, court, and availability.
- [ ] Add matching rules and a ranked result contract.
- [ ] Add advocate opt-in, verification status, and conflict-aware exclusion.
- [ ] Add advocate-facing profile management.
- [ ] Track match acceptance and outcomes.

### 4.3 Court tracking

- [ ] Add `cases`, `hearings`, and `case_events`.
- [ ] Integrate a court-data source or manual clerk workflow.
- [ ] Add client-visible timelines and notifications.
- [ ] Handle PII and case sensitivity carefully.

### 4.4 Payments and fees

- [ ] Replace display-only fee strings with structured amounts/currency.
- [ ] Add a payment provider adapter and `orders` table.
- [ ] Reconcile consultation and package payments.
- [ ] Add invoices/receipts and refund handling.
- [ ] Keep fee copy and charged amounts consistent.

### 4.5 Multilingual delivery

- [ ] Add locale columns or translation tables for content.
- [ ] Add UI localization for the six supported languages.
- [ ] Add language-aware search and advocate filters.
- [ ] Review legal notices with translators.

---

## Immediate backend backlog

Ordered suggestions for the next backend iteration:

1. Add response schemas to routes so OpenAPI documents payloads, not just
   requests.
2. Add tests for practices detail 404, matter/insight categories, catalog
   ordering, and advocate pagination boundaries.
3. Add an `admin` auth boundary before any write endpoints.
4. Add intake status transitions and an audit table.
5. Add a `notifications` outbox and email adapter.
6. Add a retention/anonymization command for intake and newsletter data.
7. Add structured request logging that excludes bodies.
8. Add a `GET /api/v1/health` alias or document the current split clearly (health
   is outside `/api/v1` by design).
9. Add CI for typecheck, lint, test, and build.
10. Plan the PostgreSQL conversion before any multi-instance deployment.

---

## Known gaps & next steps

| Area | Status / Remaining Gap |
| --- | --- |
| Auth & OTP | Email/password auth & JWT implemented; SMS gateway integration (Twilio/MSG91) pending |
| Messaging | Chambers dispatch chat currently runs in consultation relay; persistent WebSocket/messages table pending |
| Document OCR | Client-side OCR preview active; dedicated Indic vision OCR backend service integration scheduled |
| Reviews | Consultation rating collected on frontend; backend `POST /api/v1/reviews` endpoint pending |
| Storage | Documents stored in local private vault (`storage/vault`); S3/R2 cloud storage adapter recommended for cloud deployment |
| Corpus Ingestion | 5 foundational Bare Acts seeded; automated IndiaCode statutory ingestion pipeline planned |
| Testing | Backend Pytest (79 tests) and frontend functional checks passing; frontend E2E (Playwright) suite pending |
| CI/CD | GitHub Actions pipeline for automated pytest, lint, and build verification pending |

## Definition of done (general)

A feature is done when:

- The API contract and validation are documented.
- Tests cover success and failure paths.
- Errors use the standard envelope.
- PII handling and compliance copy are reviewed.
- The frontend has loading, empty, and error states.
- `docs/` is updated in the same change.
- Typecheck, lint, tests, and builds pass.


---

## Backend Feature Gap Report

# NyayaSetu (न्यायसेतु) — Backend Feature Gap & Integration Report

**Date of Audit:** November 19, 2026  
**Auditor:** Senior Principal Systems Architect & Legal Technology Specialist  
**Status:** Audit Complete · Zero Code Modifications (Phase 1)

---

## 1. Executive Summary

This report provides an objective, code-verified comparison between:
1. The **implemented capabilities** of the Python 3.12 / FastAPI backend (`backend/`).
2. The **simulated capabilities** exhibited by the Next.js 16 frontend (`frontend/`).

### Foundational Finding
**The frontend currently makes zero API requests to the backend.**  
Every screen in the `/dashboard/*` portal and `/login` runs on local browser memory (`localStorage`), static mock arrays (`src/data/`), and simulated service modules (`src/services/dashboard/`). Meanwhile, the FastAPI backend has **45 fully implemented, tested, and validated endpoints** with PostgreSQL schemas, PostGIS spatial queries, pgvector embeddings, and cryptographic file security. The integration phase will connect these two mature, complementary halves.

---

## 2. Feature Implementation Status Matrix

| Subsystem / Feature | Backend Implementation (Verified) | Frontend Implementation (Verified) | Integration Gap / Verdict |
| :--- | :--- | :--- | :--- |
| **Authentication & Registration** | Argon2id password hashing, JWT access & rotated refresh tokens, role enforcement (`CITIZEN`, `ADVOCATE`, `ADMIN`). | Simulated Mobile OTP with hardcoded `123456`, demo advocate enrolment login, `localStorage` session. | **Gap: Protocol mismatch.** Frontend expects phone OTP; backend currently uses email + password. Need OTP endpoint or email/password form alignment. |
| **Advocate Verification** | 4-stage State Bar Council workflow (`PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`), document upload, admin decision ledger. | Static mock advocate profiles. Admin verification pages are not present on frontend. | **Gap: Frontend Admin UI missing.** Backend API is complete; frontend has no `/admin/verifications` screen. |
| **Case Intake** | `/api/v1/cases` persists `LegalCase` with unique reference code, category, jurisdiction, urgency, and client scoping. | 5-step intake wizard in `/dashboard/intake` storing state in `localStorage`. | **Ready for connection.** Direct payload mapping exists between frontend wizard and backend schema. |
| **Legal Triage** | `/api/v1/triage/assess` deterministic decision engine categorizing into 4 statutory paths. | Client-side rule engine in `services/dashboard/triage.ts` rendering triage paths and DLSA aid thresholds. | **Ready for connection.** Frontend can call `/api/v1/triage/assess` or save triage output directly into case dossier. |
| **Advocate Matching** | Multi-factor engine (Practice 35%, Court 25%, Language 20%, Proximity 10%, Availability 10%) using PostGIS geography. | Client-side filter over 4 hardcoded mock advocates. | **Ready for connection.** Frontend should query `/api/v1/matching/advocates` with query params. |
| **Legal AI Assistant (RAG)** | Grounded RAG over curated Bare Acts (NI Act, CPA, NALSA, RERA, BNSS) with pgvector similarity and `CitationValidator`. | Client-side simulated chat in `/dashboard/chat` with canned message responses. | **Ready for connection.** Frontend `streamAnswer` can call `/api/v1/legal/ask`. |
| **Document Vault** | Private storage vault (`backend/storage/vault/`), SHA-256 byte checksum, 25MB limit, signed 15-minute JWT download tokens. | Client-side mock table in `/dashboard/vault` with simulated uploads and mock links. | **Ready for connection.** Wire upload form to `/api/v1/documents/cases/{id}/upload` and stream via signed tokens. |
| **Consultation Booking** | Booking reference, timezone support, overlapping slot conflict prevention (`409 Conflict`), advocate confirmation. | Slot picker in `/dashboard/booking/[advocateId]` with mock checkout and confirmation screen. | **Ready for connection.** Wire booking submission to `/api/v1/appointments`. |
| **Statutory Deadlines** | Manual/statutory deadline creation, advocate confirmation review, alert schedules, `AuditLog`. | Dual-view list and calendar in `/dashboard/deadlines` with mock completion toggles. | **Ready for connection.** Wire to `/api/v1/deadlines`. |
| **Document OCR & Scanner** | Stored in vault with metadata; **no OCR extraction pipeline** in backend. | Simulated OCR progress bar and mock regex entity extraction in `/dashboard/scan`. | **Backend Gap:** Backend lacks an OCR processing service (Tesseract / Vision API). |
| **P2P Advocate Messaging** | Backend has `CaseMessage` inside `legal_cases`; **no standalone peer chat thread table**. | Multi-thread chat interface in `/dashboard/messages` with simulated automated replies. | **Backend Gap:** Backend lacks a dedicated direct messaging model outside case files. |
| **Post-Consultation Feedback** | Backend has no review/rating table. | Star rating and review form in `/dashboard/feedback/[bookingId]`. | **Backend Gap:** Backend needs a `consultation_feedback` table and endpoint. |
| **Self-Help Notice Generator** | Not in backend (handled via client browser print). | Interactive template editor with live HTML print preview in `/dashboard/self-help`. | **No Gap:** Client-side HTML printing is superior and lighter than server PDF rendering. |
| **Emergency Helplines** | Intentionally not in backend. | Low-bandwidth offline-first helpline dialer in `/dashboard/emergency`. | **No Gap:** Offline client execution is an intentional safety feature. |

---

## 3. High-Priority Backend Gaps to Address in Future Stages

1. **Authentication Alignment (Phone OTP vs Email/Password):**
   - *Current Backend:* Uses standard enterprise credentials (`email` + `password`).
   - *Current Frontend:* Uses Indian citizen phone OTP (`+91` 10-digit mobile number) with hardcoded `123456`.
   - *Recommendation:* Add an SMS OTP provider integration (or development mock OTP handler) on the backend at `POST /api/v1/auth/otp/send` and `POST /api/v1/auth/otp/verify` while preserving email/password for advocate/admin logins.

2. **OCR & Notice Entity Extraction Pipeline:**
   - *Current Frontend:* `/dashboard/scan` simulates text recognition and extracts demand amounts and limitation dates.
   - *Current Backend:* Accepts files up to 25MB and calculates SHA-256 hashes, but does not extract text.
   - *Recommendation:* Implement an asynchronous document analysis service using `pytesseract` or cloud OCR in `backend/app/modules/documents/ocr.py`.

3. **Direct Advocate-Citizen Messaging Threads:**
   - *Current Frontend:* Displays an advocate inbox with threaded messaging, unread counts, and attachment sharing.
   - *Current Backend:* Only supports `case_messages` tied to an active `legal_cases.id`.
   - *Recommendation:* Add a `MessageThread` and `DirectMessage` schema in backend for pre-litigation advocate consultations.

4. **Consultation Rating & Feedback Model:**
   - *Current Frontend:* Has `/dashboard/feedback/[bookingId]`.
   - *Current Backend:* `appointments` records stop at `COMPLETED`.
   - *Recommendation:* Add `rating_stars` (1-5) and `feedback_text` columns to `appointments` or a dedicated `consultation_feedbacks` table.

---

## 4. Duplicate, Redundant, or Deprecated Code in Frontend

1. **Duplicate UI Primitives:**
   - `src/components/dashboard/ui.tsx` defines duplicate versions of `Button`, `Card`, `Badge`, `Input`, `Select`, `Modal`, and `Tabs` that re-implement `src/components/ui/` with rounded pill borders (`rounded-2xl`, `rounded-xl`).
   - *Resolution:* Replace dashboard components with the canonical editorial primitives in `src/components/ui/` to enforce design consistency.

2. **Duplicate Advocate Data Stores:**
   - `src/data/lawyers.ts` (Partners for marketing pages) and `src/data/dashboard-mock-data.ts` (Advocates for dashboard matching) have overlapping, partially synchronized mock advocate lists.
   - *Resolution:* Unify advocate static seed data into a single source of truth until backend API integration.

3. **Legacy Template Copy Debt:**
   - `src/data/practices.ts` and `src/data/fixed-fees.ts` retain legacy template references to Chicago courtrooms ("LaSalle Street", "Ellery Kowal LLP", USD `$`).
   - *Resolution:* Harmonize remaining legacy text to the canonical Indian NyayaSetu identity.


---

## Feature Implementation Matrix

# NyayaSetu (न्यायसेतु) — Feature Implementation Matrix & Architecture Analysis

**Audit Date:** November 19, 2026  
**Auditor:** Antigravity Architecture & Legal Engineering Specialist  
**Technology Stack:**
* **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript 5
* **Backend:** Python 3.12, FastAPI 0.115, SQLAlchemy 2 (async), PostgreSQL + PostGIS (`geoalchemy2`) + pgvector, Alembic
* **Integration Status:** Frontend currently runs on simulated mock services (`src/services/dashboard/`); Backend has 45 implemented, tested, and validated endpoints with 79 passing tests.

---

## 1. Feature Implementation Matrix

The matrix below evaluates all target features across the four core modules (**Citizen**, **Advocate**, **Admin**, **AI**).

Classification definitions:
* **Implemented:** Full backend models, business logic, endpoints, and automated tests are complete.
* **Partially implemented:** Subsystem exists in either backend or frontend, but requires integration, schema extensions, or bridging endpoints.
* **Missing:** Neither backend endpoints nor database models currently exist for this feature.
* **Not required for current project scope:** Non-essential or out-of-scope for the core MVP release.

| Feature | Existing Backend | Existing API | Frontend Connected | Status | Required Work |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CITIZEN MODULE** | | | | | |
| Registration and login | Yes (`users`, `refresh_tokens`, Argon2id) | `POST /auth/register`<br>`POST /auth/login`<br>`POST /auth/refresh`<br>`POST /auth/logout` | No (Simulated OTP with hardcoded `123456`) | Partially implemented | Align protocol mismatch: implement phone OTP backend endpoint (`/auth/otp/*`) or connect email/password form; store JWT in secure cookies. |
| Citizen profile | Yes (`User` model) | `GET /auth/me` | No (Updates `localStorage`) | Partially implemented | Add `PATCH /api/v1/users/me` endpoint on backend to support citizen profile updates (city, language, full name, email). |
| AI legal assistant | Yes (Grounded RAG, 768-D pgvector embeddings, Bare Acts) | `POST /legal/ask` | No (Simulated delay in `chat.ts`) | Partially implemented | Connect frontend chat UI (`/dashboard/chat`) to `POST /api/v1/legal/ask`; display verified citations and source URLs. |
| Preliminary legal case assessment | Yes (`DeterministicTriageEngine`) | `POST /triage/assess`<br>`POST /cases/{id}/triage` | No (Client-side rules in `triage.ts`) | Partially implemented | Connect frontend `/dashboard/triage` and intake wizard to `POST /api/v1/triage/assess`; persist triage outputs in case dossier. |
| Legal issue categorization | Yes (Deterministic classification across 6+ Indian domains) | `POST /triage/assess`<br>`POST /cases` | No (Client-side keyword matching) | Partially implemented | Replace client-side heuristic mapping with backend triage categorization response. |
| Advocate discovery and matching | Yes (`AdvocateMatchingEngine`, PostGIS, BCI Rule 36 compliant) | `GET /matching/cases/{id}/advocates`<br>`GET /matching/advocates` | No (Filters 4 static mock advocates) | Partially implemented | Connect frontend `/dashboard/advocates` to `/api/v1/matching/cases/{id}/advocates` and `/matching/advocates` with query filters. |
| Advocate profile viewing | Partial (`AdvocateProfile` model, Admin endpoint exists) | `GET /admin/advocates/{id}` (Admin only) | No (Reads mock array in `dashboard-mock-data.ts`) | Partially implemented | Add public/citizen endpoint `GET /api/v1/advocates/{id}` on backend to expose non-confidential advocate profile details. |
| Appointment requests | Yes (`Appointment` model, conflict checks, `ConsultationRequest`) | `POST /appointments`<br>`GET /appointments`<br>`POST /matching/consultation-requests` | No (Simulated 10-minute hold in `bookings.ts`) | Partially implemented | Connect consultation scheduling form (`/dashboard/booking/[advocateId]`) to `POST /api/v1/appointments`. Integrate real payment gateway. |
| Case creation and case tracking | Yes (`LegalCase` model, reference `NYA-2026-CS-XXXX`) | `POST /cases`<br>`GET /cases`<br>`GET /cases/{id}`<br>`PATCH /cases/{id}` | No (`localStorage` state) | Partially implemented | Connect 5-step intake wizard (`/dashboard/intake`) and case list (`/dashboard/cases`) to `/api/v1/cases` endpoints. |
| Case summaries and briefs | Partial (Triage output stores summary of facts and legal basis) | `GET /cases/{id}` (returns `triage_result`) | No (Client-side template prefilled from `localStorage`) | Partially implemented | Add dedicated case brief generation/export endpoint (`POST /api/v1/cases/{id}/generate-brief`) or serialize brief schema. |
| Document upload and management | Yes (Private vault, SHA-256 hashing, signed 15-min JWT download tokens) | `POST /documents/cases/{id}/upload`<br>`GET /documents/cases/{id}`<br>`GET /documents/{id}/access-token`<br>`GET /documents/{id}/download` | No (Simulated upload and mock table in `vault/page.tsx`) | Partially implemented | Connect frontend vault to `/api/v1/documents/*` endpoints for multipart uploads and authorized token streaming. |
| Document scanning and explanation | No (No OCR or vision text extraction pipeline) | None | No (Mock regex extraction in `scan/page.tsx`) | Missing | Implement an OCR parsing pipeline (`pytesseract` or Cloud Vision) and a legal explainer service (`POST /documents/ocr`). |
| Deadline tracking | Yes (`Deadline` model, advocate review confirmation, reminders JSON) | `POST /deadlines`<br>`GET /deadlines`<br>`PATCH /deadlines/{id}/confirm`<br>`PATCH /deadlines/{id}/complete` | No (`localStorage` state in `deadlines/page.tsx`) | Partially implemented | Connect frontend `/dashboard/deadlines` to `/api/v1/deadlines` endpoints. Implement background scheduler for push reminders. |
| Notifications and messages | Partial (`CaseMessage` model exists in `cases/models.py`) | None exposed | No (Simulated multi-thread auto-reply in `messages/page.tsx`) | Missing | Implement general `MessageThread` and `DirectMessage` models/endpoints outside case files; add WebSocket or polling for live exchange. |
| Legal guides and self-help resources | Partial (`LegalSource` bare acts repository exists) | `GET /legal/admin/sources` (Admin only) | Client-side self-help editor (`self-help/page.tsx`) operates standalone | Partially implemented | Self-help notice generator operates via browser print (working); add public guide retrieval endpoints (`GET /legal-knowledge/guides`). |
| **ADVOCATE MODULE** | | | | | |
| Advocate registration and login | Yes (Dedicated Bar Council onboarding + standard login) | `POST /auth/register/advocate`<br>`POST /advocates/apply`<br>`POST /auth/login` | No (Simulated demo advocate switch) | Partially implemented | Connect frontend login Advocate tab to `POST /auth/login` and create advocate onboarding screen connected to `/auth/register/advocate`. |
| Advocate profile management | Yes (`AdvocateProfile` model, `GET /advocates/me`) | `GET /advocates/me`<br>`POST /advocates/apply` | No (No dedicated advocate portal screen) | Partially implemented | Add `PATCH /api/v1/advocates/me` for profile updates (fees, courts, bio). Build frontend Advocate Portal interface. |
| Bar Council enrolment details and verification status | Yes (Verification lifecycle: `PENDING` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `VERIFIED` / `REJECTED`) | `POST /advocates/me/verification`<br>`GET /advocates/me/verification`<br>`POST /advocates/me/verification/documents`<br>`GET /advocates/me/verification/documents/{id}/download` | No (Static "Verified" badges only) | Partially implemented | Build advocate credential submission screen in frontend; wire document uploads to `/advocates/me/verification/documents`. |
| Practice areas and court jurisdiction | Yes (Primary + secondary practices array, admitted courts array) | `POST /advocates/apply`<br>`GET /advocates/me` | No | Partially implemented | Expose practice areas and court jurisdictions on advocate management screen. |
| Languages and location | Yes (Languages array, city, district, state, coordinates) | `POST /advocates/apply`<br>`GET /advocates/me` | No | Partially implemented | Include language and court location configuration in advocate profile view. |
| Experience and consultation fees | Yes (`in_practice_years`, `fixed_consultation_fee_inr`) | `POST /advocates/apply`<br>`GET /advocates/me` | No | Partially implemented | Wire fee schedule editing to advocate settings. |
| Client enquiries | Yes (`ConsultationRequest` query filtered by `targeted_advocate_id`) | `GET /matching/consultation-requests` | No | Partially implemented | Build advocate inquiry dashboard to review and accept/decline client inquiries. |
| Appointment management | Yes (Advocate can view bookings and accept/reject with reason) | `GET /appointments`<br>`GET /appointments/{id}`<br>`PATCH /appointments/{id}/status` | No | Partially implemented | Build advocate schedule management view connected to `PATCH /appointments/{id}/status`. |
| Case management (Advocate view) | Partial (`LegalCase.assigned_advocate_id` foreign key exists) | `GET /cases/{id}` (allowed for assigned advocate) | No | Partially implemented | Add `GET /api/v1/cases?role=advocate` query to list all cases assigned to the advocate's chamber. |
| Document access with appropriate authorization | Yes (Strict RBAC: advocate can access documents only for assigned cases) | `GET /documents/cases/{id}`<br>`GET /documents/{id}/download` | No | Partially implemented | Build advocate document review interface enforcing assigned case boundaries. |
| Notifications and communication (Advocate) | No (No standalone direct chat table) | None | No | Missing | Implement direct communication thread model and notification hooks for advocate dashboard. |
| **ADMIN MODULE** | | | | | |
| User management | Partial (`User` model, `AuditLog`, `require_roles("ADMIN")`) | None for admin user listing | No | Partially implemented | Create `GET /api/v1/admin/users` and `PATCH /api/v1/admin/users/{id}/status` (suspend/activate). Build admin user view. |
| Advocate verification workflow | Yes (Pending lists, detailed inspection, document review, info requests) | `GET /admin/advocates/pending`<br>`GET /admin/advocates/{id}`<br>`GET /admin/advocate-verifications`<br>`GET /admin/advocate-verifications/{id}`<br>`POST /admin/advocate-verifications/{id}/request-info`<br>`GET /admin/advocate-verifications/documents/{id}/download` | No (No admin screen in frontend) | Partially implemented | Build frontend Admin Verification Desk (`/admin/advocates`) connected to backend verification endpoints. |
| Advocate approval or rejection | Yes (Records decision, reason, evidence level, immutable audit log) | `PATCH /admin/advocates/{id}/verification`<br>`POST /admin/advocate-verifications/{id}/decision` | No | Partially implemented | Provide action buttons (Approve / Reject / Request Information) on admin verification screen. |
| Case and platform oversight | Partial (Admins can view any case or appointment via ID) | `GET /cases/{id}`<br>`GET /appointments` | No | Partially implemented | Add dedicated `GET /api/v1/admin/cases` endpoint to allow platform oversight across all active disputes. |
| Reports and analytics | Partial (`AuditLog` records event telemetry) | None | No | Not required for current project scope | Aggregate platform metrics (cases triaged, matching success, consultations concluded) for future administrative dashboard. |
| Content management | Partial (Admin legal source registration & Bare Act chunking) | `POST /legal/admin/sources`<br>`POST /legal/admin/sources/{id}/chunks`<br>`POST /legal/admin/seed`<br>`GET /legal/admin/sources` | No (Marketing content is static in `src/data/`) | Partially implemented | Legal knowledge base corpus is managed via API; marketing site content management can remain static/file-based for MVP. |
| Complaint and support management | No (No `grievances` or `support_tickets` database model) | None | No (Contact email rendered in UI) | Missing | Add `grievances` database table, filing endpoint (`POST /support/grievances`), and admin resolution workflow. |
| **AI MODULE** | | | | | |
| Legal query processing | Yes (`LegalAssistantService`, language/jurisdiction normalization) | `POST /legal/ask` | No | Partially implemented | Connect frontend `/dashboard/chat` user input to query processing pipeline. |
| Legal issue classification | Yes (`DeterministicTriageEngine` domain classification) | `POST /triage/assess`<br>`POST /cases` | No | Partially implemented | Replace client-side keyword heuristics with backend triage classification. |
| Preliminary case assessment | Yes (Summary of facts, missing info, jurisdiction, urgency, next steps) | `POST /triage/assess`<br>`POST /cases/{id}/triage` | No | Partially implemented | Map backend triage output schema to frontend course-of-action cards. |
| Case brief generation | Partial (Structured facts generated by triage engine) | `GET /cases/{id}` (returns `triage_result`) | No (Client-side template prefilling) | Partially implemented | Implement dedicated endpoint `POST /api/v1/cases/{id}/generate-brief` returning formatted legal brief. |
| Document explanation | No (No document OCR or statutory analysis pipeline) | None | No (Simulated in UI) | Missing | Implement document text parsing service and structured explainer endpoint. |
| Retrieval-augmented legal information (RAG) | Yes (Dense vector embeddings via pgvector, Bare Acts, hybrid search) | `POST /legal/ask` | No | Partially implemented | Wire frontend chat interface to consume RAG answer payload with source grounding. |
| Source references | Yes (`CitationValidator` verifies cited sections against retrieved chunks) | `POST /legal/ask` (returns `citations` array with checksums & URLs) | No | Partially implemented | Render verified statutory citation cards in frontend chat UI using returned references. |

---

## 2. In-Depth Subsystem Analysis

### 2.1 Citizen Module Analysis

#### 1. Registration & Authentication
* **Backend Exists:** Yes. Built with Argon2id password hashing and short-lived JWT access tokens + rotated refresh tokens in `backend/app/modules/auth/`.
* **Database Models:**
  - `User` (`users` table): `id`, `email`, `phone`, `password_hash`, `full_name`, `role` (`CITIZEN`, `ADVOCATE`, `ADMIN`), `preferred_language`, `is_active`, `is_verified`.
  - `RefreshToken` (`refresh_tokens` table): `id`, `user_id` (FK `users.id`), `token_hash`, `expires_at`, `is_revoked`.
* **API Endpoints:**
  - `POST /api/v1/auth/register` (Public)
  - `POST /api/v1/auth/login` (Public)
  - `POST /api/v1/auth/refresh` (Public)
  - `POST /api/v1/auth/logout` (Authenticated)
  - `GET /api/v1/auth/me` (Authenticated)
* **Auth & Permissions:** Public registration/login; Bearer token for session inspection and revocation.
* **Frontend Connection:** Disconnected. Frontend `/login` simulates phone OTP with hardcoded `123456` and writes user state to `localStorage`.
* **Working Status:** Backend is fully functional with 20 passing unit tests.
* **What is Missing:** Protocol alignment between frontend (phone OTP) and backend (email + password). Needs either backend phone OTP endpoints (`/auth/otp/send`, `/auth/otp/verify`) or a dual email/phone login form in the frontend.

#### 2. Case Intake & Triage
* **Backend Exists:** Yes. Built in `backend/app/modules/cases/` and `backend/app/modules/triage/`.
* **Database Models:**
  - `LegalCase` (`legal_cases` table): `id`, `case_reference` (`NYA-2026-CS-XXXX`), `client_id` (FK `users.id`), `assigned_advocate_id` (FK `advocate_profiles.id`), `title`, `problem_description`, `legal_issue_category`, `state`, `district`, `relevant_court`, `incident_date`, `preferred_language`, `urgency`, `supporting_info`, `adverse_parties`, `status`, `triage_result`.
* **API Endpoints:**
  - `POST /api/v1/cases` (Citizen, creates case and triggers triage)
  - `GET /api/v1/cases` (Citizen, paginated listing of owned cases)
  - `GET /api/v1/cases/{case_id}` (Owner/Assigned Advocate/Admin)
  - `PATCH /api/v1/cases/{case_id}` (Owner/Admin)
  - `POST /api/v1/cases/{case_id}/triage` (Owner, re-evaluates triage)
  - `POST /api/v1/triage/assess` (Public, stateless assessment preview)
* **Auth & Permissions:** Strict citizen ownership isolation (`client_id == current_user.id`). Unauthorized access returns `403 Forbidden`.
* **Frontend Connection:** Disconnected. `/dashboard/intake` and `/dashboard/triage` evaluate rules client-side and store cases in `localStorage`.
* **Working Status:** Backend engine deterministically evaluates jurisdiction, urgency, complexity, missing facts, and next steps across NI Act, Consumer Protection, CrPC/BNSS, and civil statutes.
* **What is Missing:** Direct HTTP connection between frontend intake wizard and `/api/v1/cases` / `/api/v1/triage/assess`.

#### 3. Advocate Matching Engine
* **Backend Exists:** Yes. Implemented in `backend/app/modules/matching/` and `backend/app/modules/advocates/`.
* **Database Models:**
  - `AdvocateProfile` (`advocate_profiles` table): `id`, `user_id`, `bar_council_id`, `normalized_bar_council_id`, `bar_council_name`, `in_practice_years`, `primary_practice`, `admitted_courts`, `languages_spoken`, `fixed_consultation_fee_inr`, `city`, `district`, `state`, `location_coordinates` (PostGIS Point), `platform_verification_status`.
* **API Endpoints:**
  - `GET /api/v1/matching/cases/{case_id}/advocates` (Case owner)
  - `GET /api/v1/matching/advocates` (Public directory search)
  - `POST /api/v1/matching/consultation-requests` (Citizen)
  - `GET /api/v1/matching/consultation-requests` (Citizen/Advocate/Admin)
* **Auth & Permissions:** Hard verification filter (`platform_verification_status == "VERIFIED"`). Unverified advocates are excluded.
* **Frontend Connection:** Disconnected. `/dashboard/advocates` filters static mock advocates.
* **Working Status:** Multi-factor scoring works with PostGIS geodesic distance, language compatibility, and zero paid promotion.
* **What is Missing:** Frontend connection to `/api/v1/matching/cases/{id}/advocates`.

#### 4. Document Vault & Evidence Management
* **Backend Exists:** Yes. Implemented in `backend/app/modules/documents/`.
* **Database Models:**
  - `Document` (`documents` table): `id`, `case_id` (FK `legal_cases.id`), `uploaded_by_user_id` (FK `users.id`), `file_name`, `storage_path`, `mime_type`, `file_size_bytes`, `sha256_checksum`, `document_category`, `is_confidential`.
* **API Endpoints:**
  - `POST /api/v1/documents/cases/{case_id}/upload`
  - `GET /api/v1/documents/cases/{case_id}`
  - `GET /api/v1/documents/{document_id}`
  - `GET /api/v1/documents/{document_id}/access-token`
  - `GET /api/v1/documents/{document_id}/download`
* **Auth & Permissions:** Case ownership RBAC. Public URLs are strictly disallowed; streaming uses 15-minute signed JWT download tokens.
* **Frontend Connection:** Disconnected. `/dashboard/vault` uses local state.
* **Working Status:** Backend private vault storage, SHA-256 calculation, and token downloads are tested and working.
* **What is Missing:** Frontend connection for document uploads and streaming downloads.

---

### 2.2 Advocate Module Analysis

#### 1. Credential Verification Workflow
* **Backend Exists:** Yes. Built in `backend/app/modules/advocates/` and `backend/app/modules/admin/`.
* **Database Models:**
  - `AdvocateProfile` (`advocate_profiles`): `platform_verification_status` (`PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`).
  - `AdvocateVerificationApplication`: `enrollment_number`, `enrollment_name`, `state_bar_council`, `enrollment_date`, `aibe_status`, `cop_status`, `evidence_level`, `decision_reason`.
  - `AdvocateVerification`: `verification_type` (`ENROLLMENT_CERTIFICATE`, `BAR_ID_CARD`, `AIBE_CERTIFICATE`, `COP_CERTIFICATE`), `storage_key`, `status`.
* **API Endpoints:**
  - `POST /api/v1/advocates/apply` (Public/Advocate)
  - `GET /api/v1/advocates/me` (Advocate)
  - `POST /api/v1/advocates/me/verification` (Advocate)
  - `GET /api/v1/advocates/me/verification` (Advocate)
  - `POST /api/v1/advocates/me/verification/documents` (Advocate)
  - `GET /api/v1/advocates/me/verification/documents/{id}/download` (Advocate)
* **Auth & Permissions:** Advocate can only view and download own uploaded documents. Self-approval is blocked.
* **Frontend Connection:** Disconnected. Frontend has no advocate onboarding or verification tracking UI.
* **Working Status:** Backend verification engine correctly enforces non-automatic verification and normalization of state Bar Council numbers.
* **What is Missing:** Dedicated advocate portal pages in frontend.

#### 2. Consultations & Appointment Management
* **Backend Exists:** Yes. Implemented in `backend/app/modules/appointments/`.
* **Database Models:**
  - `Appointment` (`appointments` table): `id`, `booking_reference` (`NYA-BK-2026-XXXX`), `client_id`, `advocate_id`, `case_id`, `scheduled_start`, `scheduled_end`, `timezone`, `status` (`REQUESTED`, `CONFIRMED`, `REJECTED`, `COMPLETED`, `CANCELLED`), `mode`, `meeting_link`, `client_notes`, `rejection_reason`.
* **API Endpoints:**
  - `POST /api/v1/appointments` (Citizen)
  - `GET /api/v1/appointments` (Citizen/Advocate/Admin)
  - `GET /api/v1/appointments/{appointment_id}` (Parties/Admin)
  - `PATCH /api/v1/appointments/{appointment_id}/status` (Advocate/Admin)
* **Auth & Permissions:** Advocates can confirm (`CONFIRMED`) or reject (`REJECTED`) consultation requests targeted at their chamber.
* **Frontend Connection:** Disconnected.
* **Working Status:** Atomic conflict checks prevent double-booking.
* **What is Missing:** Frontend advocate schedule screen.

---

### 2.3 Admin Module Analysis

#### 1. Verification Desk & Oversight
* **Backend Exists:** Yes. Implemented in `backend/app/modules/admin/`.
* **Database Models:**
  - `AdvocateVerificationApplication`, `AdvocateProfile`, `AuditLog`.
* **API Endpoints:**
  - `GET /api/v1/admin/advocates/pending`
  - `GET /api/v1/admin/advocates/{id}`
  - `PATCH /api/v1/admin/advocates/{id}/verification`
  - `GET /api/v1/admin/advocate-verifications`
  - `GET /api/v1/admin/advocate-verifications/{id}`
  - `POST /api/v1/admin/advocate-verifications/{id}/decision`
  - `POST /api/v1/admin/advocate-verifications/{id}/request-info`
  - `GET /api/v1/admin/advocate-verifications/documents/{document_id}/download`
* **Auth & Permissions:** Strictly `require_roles("ADMIN")`. Every decision writes to `AuditLog`.
* **Frontend Connection:** Disconnected. No admin screens currently exist in the frontend.
* **Working Status:** Backend admin verification desk is 100% functional.
* **What is Missing:** Frontend administrative verification interface.

---

### 2.4 AI Module Analysis

#### 1. Grounded Legal AI (RAG) & Citation Validation
* **Backend Exists:** Yes. Implemented in `backend/app/modules/legal_assistant/` and `backend/app/modules/legal_knowledge/`.
* **Database Models:**
  - `LegalSource` (`legal_sources` table): Bare Acts and published court rulings with checksums and official URLs.
  - `LegalChunk` (`legal_chunks` table): Section-level text with 768-D dense vector embeddings (`pgvector`).
* **API Endpoints:**
  - `POST /api/v1/legal/ask` (Public / Optional User)
  - `POST /api/v1/legal/admin/sources` (Admin)
  - `POST /api/v1/legal/admin/sources/{id}/chunks` (Admin)
  - `POST /api/v1/legal/admin/seed` (Admin)
  - `GET /api/v1/legal/admin/sources` (Admin)
* **Auth & Permissions:** Grounded QA is open to citizens; corpus ingestion is strictly admin-only.
* **Frontend Connection:** Disconnected. Frontend `/dashboard/chat` uses simulated canned responses.
* **Working Status:** Tested and verified with 5 Indian Bare Acts (NI Act, Consumer Protection, NALSA, RERA, BNSS). `CitationValidator` prunes ungrounded citations.
* **What is Missing:** Frontend streaming connection to `/api/v1/legal/ask`.

---

## 3. Duplicate Functionality, Redundant Routes & Deprecated Code

### 3.1 Backend Duplicate Endpoints (Step Iteration Artifacts)
During step-by-step backend development, parallel routes were created for advocate verification administration:

1. **Pending Applications Listing:**
   - `GET /api/v1/admin/advocates/pending` (Step 5)
   - `GET /api/v1/admin/advocate-verifications` (Step 4)
   - *Recommendation:* Standardize on `GET /api/v1/admin/advocate-verifications`. Keep `/admin/advocates/pending` as a backward-compatible alias.

2. **Advocate Detail Inspection:**
   - `GET /api/v1/admin/advocates/{id}` (Step 5)
   - `GET /api/v1/admin/advocate-verifications/{id}` (Step 4)
   - *Recommendation:* Standardize on `GET /api/v1/admin/advocate-verifications/{id}` for verification records, reserving `/admin/advocates/{id}` for broader advocate management.

3. **Verification Status Decisions:**
   - `PATCH /api/v1/admin/advocates/{id}/verification` (Step 5)
   - `POST /api/v1/admin/advocate-verifications/{id}/decision` (Step 4)
   - *Recommendation:* Use `POST /api/v1/admin/advocate-verifications/{id}/decision` as the primary semantic action.

4. **Test & Diagnostic Routes:**
   - `GET /api/v1/auth/citizen-only`, `GET /api/v1/auth/advocate-only`, `GET /api/v1/auth/admin-only` in `auth/router.py`.
   - *Recommendation:* These are testing endpoints and should not be documented in public API contracts.

### 3.2 Frontend Redundancies
1. **Mock Data Duplication:**
   - `frontend/src/data/lawyers.ts` (marketing partners) vs `frontend/src/data/dashboard-mock-data.ts` (advocate directory).
   - *Resolution:* Unify advocate records under backend database seed data.
2. **Duplicate Scoped UI Components:**
   - `frontend/src/components/dashboard/ui.tsx` initially duplicated `frontend/src/components/ui/` with divergent pill radii. These have been harmonized to canonical tokens.

---

## 4. Recommended Final Feature Structure & Sequencing

The platform should be integrated in four sequential stages without replacing the existing architecture:

```
┌────────────────────────────────────────────────────────┐
│ STAGE 1: AUTHENTICATION & CITIZEN DOSSIER FOUNDATION   │
│ - Connect /login & /register to backend JWT auth       │
│ - Implement Phone OTP gateway or email/password bridge │
│ - Connect /dashboard citizen profile & case dockets    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ STAGE 2: INTAKE, TRIAGE & RAG LEGAL ASSISTANT          │
│ - Connect 5-step intake wizard to POST /api/v1/cases   │
│ - Wire deterministic triage to POST /triage/assess     │
│ - Connect AI Assistant chat to POST /api/v1/legal/ask  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ STAGE 3: MATCHING, CONSULTATIONS & DOCUMENT VAULT      │
│ - Wire advocate matching to PostGIS engine             │
│ - Connect appointment scheduler & conflict prevention  │
│ - Connect document vault to encrypted storage API      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ STAGE 4: ADVOCATE PORTAL & ADMIN VERIFICATION DESK     │
│ - Build advocate verification submission UI            │
│ - Build admin verification review & decision dashboard │
│ - Connect deadlines & limitation period confirmations  │
└────────────────────────────────────────────────────────┘
```

This structure strictly adheres to project guidelines, builds upon verified existing code, and provides a clear path to end-to-end operational integration.
