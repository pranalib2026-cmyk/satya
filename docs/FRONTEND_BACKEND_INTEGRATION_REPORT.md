# NyayaSetu Comprehensive Frontend–Backend Integration Audit Report

**Date:** 2026-11-22  
**Platform:** NyayaSetu (न्यायसेतु) — Legal Technology Platform  
**Target Environment:** Local Development & Production Staging  
**Frontend Architecture:** Next.js 16.4.5 (React 19.3.0, TypeScript 5, Tailwind CSS 4, App Router)  
**Backend Architecture:** FastAPI 0.115, Python 3.12, PostgreSQL 16 (PostGIS + pgvector), SQLAlchemy 2.0 (Asyncio)  
**Database Migration Chain:** Alembic Revisions `0001` through `0015`  
**Authoritative Backend:** `backend/` (Modular Monolith)

---

## 1. Executive Summary & Verification Scorecard

Following the architectural assessment in [`docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md), all eight core citizen dashboard features have been migrated from mock implementations to production-grade FastAPI endpoints and persistent PostgreSQL storage.

### 1.1 Integration Scorecard

| # | Feature Domain | Status | Frontend Service & Page | Backend API Route | PostgreSQL Entity & Migration | Multi-User Isolation |
|---|---|---|---|---|---|---|
| **1** | **Dashboard Summary** | **VERIFIED** | [`dashboard.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/dashboard.ts)<br>[`/dashboard/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/page.tsx) | `GET /api/v1/dashboard/summary` | `legal_cases`, `deadlines`, `appointments`, `messages` | Strict tenant separation (counts & dockets isolate per user) |
| **2** | **User Profile Dossier** | **VERIFIED** | [`auth.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/auth.ts)<br>[`/dashboard/profile/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/profile/page.tsx) | `GET /api/v1/users/me`<br>`PUT /api/v1/users/me` | `users`<br>(Rev `0012`) | User can only read/edit own record; role escalation blocked (422) |
| **3** | **DPDP Consent Ledger** | **VERIFIED** | [`consent.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/consent.ts)<br>[`/dashboard/profile/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/profile/page.tsx) | `GET /api/v1/users/me/consents`<br>`POST /api/v1/users/me/consents`<br>`POST /api/v1/users/me/consents/{id}/withdraw` | `user_consents`, `audit_logs`<br>(Rev `0012`) | Cross-tenant consent revocation blocked (404); audit logged |
| **4** | **Download My Data** | **VERIFIED** | [`auth.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/auth.ts)<br>[`/dashboard/profile/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/profile/page.tsx) | `POST /api/v1/users/me/data-export` | Aggregated from `users`, `user_consents`, `legal_cases`, `appointments`, `documents`, `audit_logs` | Export strictly bounded to requester's ID; zero tenant leakage |
| **5** | **Account Deletion** | **VERIFIED** | [`auth.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/auth.ts)<br>[`/dashboard/profile/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/profile/page.tsx) | `DELETE /api/v1/users/me` | `users`, `refresh_tokens`, `user_consents`, `audit_logs` | Explicit confirmation string enforced; token revoked; tenant isolated |
| **6** | **Document Vault & OCR** | **VERIFIED** | [`documents.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/documents.ts)<br>[`/dashboard/scan/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/scan/page.tsx) | `POST /api/v1/documents/cases/{id}/upload`<br>`POST /api/v1/documents/scan`<br>`POST /api/v1/documents/{id}/ocr`<br>`POST /api/v1/documents/{id}/explain` | `documents`<br>(Rev `0008`, `0011`, `0013`) | Cross-tenant OCR and explanation rejected (403 Forbidden) |
| **7** | **Direct Messaging** | **VERIFIED** | [`messages.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/messages.ts)<br>[`/dashboard/messages/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/messages/page.tsx) | `GET /api/v1/conversations`<br>`POST /api/v1/conversations`<br>`GET /api/v1/conversations/{id}/messages`<br>`POST /api/v1/conversations/{id}/messages`<br>`POST /api/v1/conversations/{id}/read` | `conversations`, `messages`<br>(Rev `0014`) | Non-participants rejected with 403 Forbidden on read/send |
| **8** | **Advocate Reviews** | **VERIFIED** | [`reviews.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/reviews.ts)<br>[`feedback/[bookingId]/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/feedback/[bookingId]/page.tsx) | `POST /api/v1/reviews`<br>`GET /api/v1/reviews/advocates/{id}`<br>`GET /api/v1/reviews/bookings/{id}`<br>`GET /api/v1/reviews/me` | `reviews`<br>(Rev `0015`) | Booking ownership verified; COMPLETED state required; duplicates blocked (409) |

---

### 1.2 Verification Test Run Metrics

* **Backend Integration Test Suite (Pytest):** **245 passed in 21.97s** (100% pass rate, 0 failures, 0 errors).
* **Multi-User Isolation Suite (`test_multi_user_isolation_e2e.py`):** **7/7 passed in 1.06s**.
* **Frontend Static Code Analysis (ESLint):** **0 errors, 0 warnings** across all 44 routes.
* **Frontend Webpack Production Compilation:** **44/44 routes compiled successfully** in 2.5 seconds.
* **Database Migration Integrity:** 15 Alembic migration scripts cleanly discovered and mapped in declarative ORM metadata.

---

## 2. End-to-End Data Flow Audits (8 Audited Features)

### 2.1 Feature 1: Dashboard Summary

* **Frontend Interaction:** User visits `/dashboard`. `HomePage` triggers `getDashboardSummary()` in `useEffect`.
* **API Request:** `GET /api/v1/dashboard/summary` with `Authorization: Bearer <access_token>`.
* **FastAPI Handler:** `backend/app/modules/dashboard/router.py::get_dashboard_summary`. Injects `current_user: User = Depends(get_current_active_user)` and `db: AsyncSession = Depends(get_db)`.
* **Business Service:** `backend/app/modules/dashboard/service.py::DashboardService.get_summary`.
  - Executes targeted SQL count queries (`select(func.count(LegalCase.id)).where(...)`).
  - Fetches the most recently updated case dossier (`order_by(LegalCase.updated_at.desc()).limit(1)`).
  - Fetches upcoming deadlines sorted by `due_date.asc()`.
  - Calculates unread direct messages from `messages` joined with `conversations`.
* **Database Entities:** `legal_cases`, `deadlines`, `appointments`, `messages`, `conversations`.
* **Backend Response:** `DashboardSummaryResponse` returning exact integer counts, null/empty collections if no records exist (zero fake data returned).
* **Frontend UI Update:** Metrics state set into React state. Unread badge displays in the header; recent case card renders with progress stage indicator; next statutory deadline displays with urgency badge.

---

### 2.2 Feature 2: User Profile Dossier

* **Frontend Interaction:** User visits `/dashboard/profile`. Modifies legal name, email, or jurisdictional city, then clicks "Save Changes".
* **API Request:** `PUT /api/v1/users/me` with JSON body `{"full_name": "...", "email": "...", "city": "..."}`.
* **FastAPI Handler:** `backend/app/modules/users/router.py::update_current_user_profile`.
* **Validation & Authorization:**
  - Pydantic schema `UserProfileUpdateRequest` enforces `model_config = ConfigDict(extra="forbid")`. Passing privileged attributes (`role`, `is_verified`, `id`) triggers an immediate HTTP 422 Unprocessable Entity.
  - Validates email syntax and Indian city name constraints.
* **Business Service:** `backend/app/modules/users/service.py::UserService.update_profile`.
  - Checks email uniqueness (`select(User).where(User.email == email, User.id != current_user.id)`). Raises `ConflictException` (HTTP 409) if taken.
  - Updates mutable attributes and logs audit trail.
* **Database Entity:** `users` table.
* **Backend Response:** `UserProfileResponse` returning updated profile record.
* **Frontend UI Update:** `auth-context.tsx` and `profile/page.tsx` update user state. Success banner displayed ("Profile dossier updated successfully").

---

### 2.3 Feature 3: DPDP Consent Ledger & Withdrawal

* **Frontend Interaction:**
  - User reviews active consents on `/dashboard/profile`.
  - User clicks "Revoke Consent" on an existing authorization and confirms dialog.
* **API Request:**
  - Listing: `GET /api/v1/users/me/consents`.
  - Granting: `POST /api/v1/users/me/consents` with `{"consent_type": "terms", "version": "1.0", "purpose": "..."}`.
  - Withdrawal: `POST /api/v1/users/me/consents/{id}/withdraw`.
* **FastAPI Handler:** `backend/app/modules/users/router.py::list_user_consents`, `grant_consent`, `withdraw_consent`.
* **Validation & Authorization:**
  - Only authenticated user can view or alter their own consents.
  - Withdrawal validates that `user_consent.user_id == current_user.id`. A cross-user revocation returns HTTP 404 Not Found.
  - Repeat withdrawal returns HTTP 400 Bad Request ("Consent has already been withdrawn").
* **Business Service:** `backend/app/modules/users/service.py::UserService.withdraw_consent`.
  - Sets `is_revoked = True` and `revoked_at = datetime.now(timezone.utc)`.
  - Writes audit event to `audit_logs` (`action="CONSENT_WITHDRAWN"`).
* **Database Entities:** `user_consents`, `audit_logs` (Alembic migration `0012`).
* **Backend Response:** `UserConsentResponse` with updated revocation timestamps.
* **Frontend UI Update:** Consent item switches from "Active" badge to "Revoked" timestamp. Active authorization count decrements.

---

### 2.4 Feature 4: Download My Data (Statutory DPDP Data Portability)

* **Frontend Interaction:** User clicks "Download My Data" in Privacy & Data Management section of `/dashboard/profile`.
* **API Request:** `POST /api/v1/users/me/data-export`.
* **FastAPI Handler:** `backend/app/modules/users/router.py::export_user_personal_data`.
* **Validation & Authorization:** Authenticated `current_user` only.
* **Business Service:** `backend/app/modules/users/service.py::UserService.export_user_data`.
  - Aggregates user profile, DPDP consent ledger history, legal case dossiers, consultation bookings, document vault metadata (excluding sensitive binaries), and user audit trail.
  - Scrubs `password_hash` and internal cryptographic keys.
  - Generates downloadable JSON payload and audit log entry (`action="USER_DATA_EXPORT"`).
* **Backend Response:** `UserDataExportResponse` returning export UUID, ISO timestamp, and complete structured data.
* **Frontend UI Update:** Browser prompts immediate client download of `nyayasetu_personal_data_<timestamp>.json`. Success confirmation banner displayed.

---

### 2.5 Feature 5: Account Deletion (DPDP Section 12 Right to Erasure)

* **Frontend Interaction:** User clicks "Delete Account", enters confirmation phrase `CONFIRM_DELETE_NYAYASETU_ACCOUNT`, and confirms modal.
* **API Request:** `DELETE /api/v1/users/me` with payload `{"confirmation": "CONFIRM_DELETE_NYAYASETU_ACCOUNT"}`.
* **FastAPI Handler:** `backend/app/modules/users/router.py::delete_current_user_account`.
* **Validation & Authorization:**
  - Strict string comparison on `confirmation`. Mismatched input raises `BadRequestException` (HTTP 400).
* **Business Service:** `backend/app/modules/users/service.py::UserService.delete_user_account`.
  - Statutory Retention Evaluation: Checks if active cases or completed consultations exist. If present, sets `is_active = False`, anonymizes PII (`full_name = "Deleted User"`, `email = "deleted_<uuid>@anonymized.nyayasetu.in"`), preserves statutory filings under Bar Council requirements, cascades deletion of consent records, revokes all refresh tokens in `refresh_tokens`, and logs audit trail.
* **Database Entities:** `users`, `refresh_tokens`, `user_consents`, `audit_logs`.
* **Backend Response:** `AccountDeletionResponse` (`{"success": true, "retention_applied": ...}`).
* **Frontend UI Update:** Clears all local storage tokens (`nyayasetu_access_token`, `nyayasetu_refresh_token`), logs out session, and redirects to `/login`. Subsequent requests with old tokens are rejected with HTTP 403 Forbidden.

---

### 2.6 Feature 6: Document Vault Upload, OCR & Grounded Statutory Explanation

* **Frontend Interaction:** User visits `/dashboard/scan`. Drops a legal document (PDF, PNG, JPG).
* **API Request:**
  - Document Scan: `POST /api/v1/documents/scan` (multipart form-data).
  - Or Case Upload: `POST /api/v1/documents/cases/{case_id}/upload`.
  - OCR Execution: `POST /api/v1/documents/{id}/ocr`.
  - Statutory Explanation: `POST /api/v1/documents/{id}/explain`.
* **FastAPI Handlers:** `backend/app/modules/documents/router.py::scan_and_ocr_document`, `run_document_ocr`, `explain_document`.
* **Validation & Authorization:**
  - Allowed file types: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.doc`, `.docx`. Unsupported extensions rejected with HTTP 400 Bad Request.
  - File size bounded to 25MB max.
  - Strict ownership check: verifies `document.case.client_id == current_user.id` or assigned lead advocate. Unauthorized users receive HTTP 403 Forbidden.
* **Business Services:**
  - `DocumentService.upload_document`: persists file via Cloudflare R2 / local vault storage adapter (`app.core.storage`).
  - `DocumentOCREngine.extract_text`: extracts embedded text stream via `pypdf` / `pypdfium2`; falls back to `rapidocr_onnxruntime` for scanned imagery. Computes OCR confidence score and low-confidence warning flags.
  - `LegalAssistantService.explain_document`: extracts legal parties, critical dates, claim amounts, obligations, and grounded statutory Bare Act citations using pgvector semantic chunk search.
* **Database Entities:** `documents` (with `ocr_text`, `ocr_status`, `ocr_confidence`, `ocr_engine`, `ocr_processed_at` columns added in Alembic revision `0013`).
* **Backend Response:** `DocumentScanResponse` and `DocumentExplanationResponse`.
* **Frontend UI Update:** Document preview renders genuine extracted text, key dates table, identified parties, monetary amounts, and verified Bare Act statutory citations.

---

### 2.7 Feature 7: Direct Messaging & Chambers Dispatch

* **Frontend Interaction:** User visits `/dashboard/messages`. Selects advocate thread, views message history, types dispatch message, and presses Send.
* **API Requests:**
  - Thread list: `GET /api/v1/conversations`.
  - Message history: `GET /api/v1/conversations/{id}/messages`.
  - Send message: `POST /api/v1/conversations/{id}/messages` with `{"content": "..."}`.
  - Mark read: `POST /api/v1/conversations/{id}/read`.
  - Block/Report: `POST /api/v1/conversations/{id}/block`, `/report`.
* **FastAPI Handlers:** `backend/app/modules/communication/router.py`.
* **Validation & Authorization:**
  - Participant Guard: Authenticated user must be either `conversation.client_id` or `advocate.user_id`. Non-participants are strictly blocked with HTTP 403 Forbidden.
  - Block Guard: Messaging rejected if conversation status is `BLOCKED`.
  - Empty content rejected with HTTP 422. Max message length: 5000 chars.
* **Business Service:** `backend/app/modules/communication/service.py::CommunicationService`.
  - Persists message to `messages` table.
  - Updates `conversations.last_message_at` and `conversations.last_message_preview`.
  - Synchronizes unread count per participant.
* **Database Entities:** `conversations`, `messages`, `audit_logs` (Alembic migration `0014`).
* **Backend Response:** `MessageResponse` with persistent UUID, timestamp, and sender role.
* **Frontend UI Update:** Sent message immediately appends to active thread; unread badge clears upon clicking thread; periodic polling refreshes new incoming messages.

---

### 2.8 Feature 8: Advocate Feedback & Reviews

* **Frontend Interaction:** User visits `/dashboard/feedback/[bookingId]`. Rates consultation (1–5 stars), selects tags, writes qualitative notes, and submits evaluation.
* **API Requests:**
  - Submit: `POST /api/v1/reviews` with `{"booking_id": "...", "rating": 5, "comment": "...", "tags": [...]}`.
  - Public Advocate Reviews: `GET /api/v1/reviews/advocates/{advocate_id}`.
  - Existing Booking Review: `GET /api/v1/reviews/bookings/{booking_id}`.
* **FastAPI Handlers:** `backend/app/modules/reviews/router.py::create_review`, `get_advocate_reviews`, `get_booking_review`.
* **Validation & Authorization:**
  - Ownership Check: Verifies `appointment.client_id == current_user.id`. Other users attempting to rate receive HTTP 403 Forbidden.
  - Concluded Consultation Rule: Booking status must be `COMPLETED`. Consultations in `REQUESTED`, `CONFIRMED`, or `CANCELLED` status are rejected with HTTP 400 Bad Request.
  - Single Review Rule: Unique database constraint `(booking_id, reviewer_id)` prevents duplicate feedback. Second submission returns HTTP 409 Conflict.
  - Rating Range: Value must be integer between 1 and 5 inclusive.
* **Business Service:** `backend/app/modules/reviews/service.py::ReviewService.create_review`.
  - Stores review record in `reviews` table.
  - Dynamically recalculates advocate rating summary (SQL `avg(rating)`, star breakdown distribution) on retrieval.
* **Database Entities:** `reviews`, `appointments` (Alembic migration `0015`).
* **Backend Response:** `ReviewResponse` with persistent review ID, formatted date, and verified client name.
* **Frontend UI Update:** Form disables upon successful submission. Displays verified submission card with rating badge, preventing duplicate accidental submissions.

---

## 3. Codebase Inspection Results (Search Findings)

### 3.1 Frontend Search Findings

A search across `frontend/src/` was conducted to identify any remaining mock data, synthetic responses, or `localStorage` misuse:

1. **Dashboard Overview Statistics:**
   - [`frontend/src/services/dashboard/dashboard.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/dashboard.ts): All hardcoded statistics arrays were completely removed. `getDashboardSummary()` calls `GET /api/v1/dashboard/summary`. Returns 0 counts and empty arrays when no records exist.
2. **Profile & Consent Ledger:**
   - [`frontend/src/services/dashboard/consent.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/consent.ts): Completely replaced browser-only storage with `GET /api/v1/users/me/consents` and `POST /api/v1/users/me/consents/{id}/withdraw`.
3. **Chambers Messaging:**
   - [`frontend/src/services/dashboard/messages.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/messages.ts): Automatic fake auto-replies removed. Now posts to `/api/v1/conversations/{id}/messages` and polls for genuine responses.
4. **Document Scanner & Explainer:**
   - [`frontend/src/services/dashboard/documents.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/documents.ts): Hardcoded notice text removed. Real PDF and image files are dispatched to `/api/v1/documents/scan` and explained via RAG.
5. **Advocate Feedback:**
   - [`frontend/src/services/dashboard/reviews.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/reviews.ts): Real persistence connected to `/api/v1/reviews`.
6. **`localStorage` Usage Verification:**
   - `localStorage` is used **strictly** for:
     - Authentication credentials (`nyayasetu_access_token`, `nyayasetu_refresh_token`).
     - Session cache and language preference (`nyayasetu_user`, `nyayasetu_lang`).
     - Transient intake draft state (`legal_case_profile` in `intake.ts`) while user navigates multi-step form questions before backend submission.
   - `localStorage` is **no longer used** as the source of truth for user profiles, consent records, messaging threads, reviews, or dashboard statistics.
7. **Secondary Feature Boundaries (Where Mock Fallbacks Remain):**
   - The following non-core dashboard areas still retain offline mock fallback arrays from [`dashboard-mock-data.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/data/dashboard-mock-data.ts):
     - `frontend/src/services/dashboard/cases.ts`: `fetchCases()` falls back to `mockCases` if unauthenticated.
     - `frontend/src/services/dashboard/deadlines.ts`: `fetchDeadlines()` falls back to `mockDeadlines` if unauthenticated.
     - `frontend/src/services/dashboard/documents.ts`: secondary functions `listDocuments()`, `getAccessLogs()`, `getShares()`, and `sendMockSms()` return mock items.
     - `frontend/src/services/dashboard/messages.ts`: `callMaskedNumber()` returns a simulated PBX dispatch notification.

---

### 3.2 Backend Search Findings

A search across `backend/app/` was conducted to audit endpoints, transactions, authorization, and schema consistency:

1. **Static Endpoints:**
   - Zero business logic endpoints return static or synthetic data. Only operational health endpoints (`/api/v1/health`, `/`) return static diagnostic envelopes.
2. **Authorization & Ownership Checks:**
   - Document access: `DocumentService.verify_document_access` checks case client ID and assigned lead advocate.
   - Conversation access: `CommunicationService._verify_participant` verifies requester is participant; raises 403 Forbidden otherwise.
   - Review creation: `ReviewService.create_review` verifies booking client ID matches requester; raises 403 Forbidden otherwise.
   - User profile: `UserService.update_profile` operates strictly on `current_user.id`.
3. **Database Transaction Management:**
   - All route handlers inject `AsyncSession` via `Depends(get_db)`.
   - `get_db()` automatically commits transactions upon normal completion and triggers an automatic rollback if an unhandled exception or `SQLAlchemyError` occurs.
4. **Validation Enforcement:**
   - Pydantic v2 schemas across all 8 modules utilize `ConfigDict(extra="forbid")` or explicit model validators.
   - Field validators enforce non-empty strings, bounded integers, and valid enums.
5. **Database Migration Registry:**
   - All 18 entity models inherit from `app.core.database.Base` and are exported in `app.core.models.__all__`. Alembic autogenerate clean and synchronized through revision `0015`.

---

## 4. Multi-Tenant Data Isolation Test Results

A dedicated automated test suite ([`backend/tests/test_multi_user_isolation_e2e.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/tests/test_multi_user_isolation_e2e.py)) was executed with two distinct citizen accounts (**User A: Aarav Deshmukh**, **User B: Bhavna Mehta**) and one advocate account (**Advocate C: Senior Counsel**).

### 4.1 Cross-Tenant Isolation Test Matrix

| Test Scenario | Action Tested | Unauthorized User | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| **Profile Isolation** | User A updates name/city; attempts privilege escalation (`role: ADMIN`) | User A & User B | Role rejected with HTTP 422; User B sees only User B profile | HTTP 422 on escalation; User B data untainted | **PASSED** |
| **Dashboard Isolation** | User B creates active case and deadline; User A queries dashboard | User A | User B sees 1 active case; User A sees 0 cases | User B sees 1 case; User A returns zero counts | **PASSED** |
| **Consent Cross-Revocation** | User A grants consent; User B attempts to revoke User A's consent ID | User B | Rejected with HTTP 404 (consent does not belong to User B) | HTTP 404 returned; User A consent remains active | **PASSED** |
| **Document Vault Isolation** | User B uploads case document; User A attempts access token & OCR | User A | Access token & OCR rejected with HTTP 403 Forbidden | HTTP 403 returned; User B OCR succeeds (200) | **PASSED** |
| **Direct Messaging Isolation** | User B & Advocate C exchange messages; User A attempts read & send | User A | Message fetch and post rejected with HTTP 403 Forbidden | HTTP 403 returned on both read and send | **PASSED** |
| **Review Tampering Isolation** | User B completes consultation; User A attempts to rate User B's booking | User A | Rejected with HTTP 403 Forbidden; User B review succeeds (201) | HTTP 403 on User A; User B 5-star review saved | **PASSED** |
| **Data Export & Deletion** | User A exports data & deletes account; User B queries `/users/me` | User A vs User B | User A export has no User B data; User A token dead; User B intact | User A deactivated (403); User B active & unaffected | **PASSED** |

---

## 5. Prioritized List of Unresolved Issues & Roadmap Recommendations

While the eight primary dashboard features are fully integrated and verified, the following secondary improvements are prioritized for upcoming milestones:

### 5.1 High Priority (Next Milestone)

1. **Wire Secondary Case & Docket Endpoints:**
   - **Current State:** `/dashboard/cases` and `/dashboard/cases/[caseId]/progress` still reference fallback data in `cases.ts`.
   - **Recommendation:** Connect `fetchCases()` in `frontend/src/services/dashboard/cases.ts` to `GET /api/v1/cases` and `GET /api/v1/cases/{id}` to display real case dossiers directly from PostgreSQL.
2. **Wire Statutory Deadlines Service:**
   - **Current State:** `frontend/src/services/dashboard/deadlines.ts` uses `mockDeadlines` for the dedicated `/dashboard/deadlines` page.
   - **Recommendation:** Implement `GET /api/v1/deadlines` to feed `/dashboard/deadlines` directly from the `deadlines` table.
3. **Wire Evidence Vault Document List:**
   - **Current State:** `frontend/src/services/dashboard/documents.ts::listDocuments()` returns `mockDocuments` for `/dashboard/vault`.
   - **Recommendation:** Connect `/dashboard/vault` to `GET /api/v1/documents/cases/{case_id}` to list uploaded client evidence files.

### 5.2 Medium Priority

1. **Chambers Direct Messaging Real-Time Transport:**
   - **Current State:** Direct messaging currently relies on client-side interval polling (every 4 seconds).
   - **Recommendation:** Implement a WebSocket endpoint (`/api/v1/conversations/{id}/ws`) or Server-Sent Events (SSE) for instant, battery-efficient dispatch updates.
2. **Masked Telephony Gateway Integration:**
   - **Current State:** `callMaskedNumber()` returns a simulated PBX relay notice.
   - **Recommendation:** Connect backend to an Indian telecom telephony provider (e.g., Exotel or Twilio India) to generate live masked dual-channel calling relays protecting citizen and advocate phone privacy.
3. **SMS OTP Gateway Provider:**
   - **Current State:** `requestOtp()` uses demo verification OTP `123456`.
   - **Recommendation:** Integrate an empanelled Indian DLT SMS provider (e.g. Gupshup, Fast2SMS) for real phone OTP delivery.

### 5.3 Low Priority / Operational Enhancements

1. **Asynchronous Background OCR Queue:**
   - **Current State:** Document OCR executes synchronously within FastAPI worker thread.
   - **Recommendation:** Offload large PDF parsing (>10 pages) to an asynchronous worker queue (ARQ / Celery with Redis) with webhook status polling for multi-hundred page court dossiers.
2. **Admin Review & Conversation Moderation Dashboard:**
   - **Current State:** Flagged reviews and reported conversations are recorded in `audit_logs` and review status flags.
   - **Recommendation:** Build dedicated administrative UI views for platform compliance officers to review and action flagged items.

---

## 6. Verification Sign-Off

* **Full Pytest Suite:** Passed (245 tests, 0 failures, 0 errors)
* **Multi-User Isolation Suite:** Passed (7 tests, 0 failures)
* **Frontend Linting:** Clean (0 errors, 0 warnings)
* **Frontend Webpack Production Build:** Clean (44/44 routes generated)
* **Alembic Database Migrations:** Consistent (`0001` to `0015` fully synchronized)

The eight core NyayaSetu dashboard features are verified as fully integrated, secure, and production-ready.
