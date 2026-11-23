# NyayaSetu Frontend-Backend Integration Audit

**Date:** November 22, 2026  
**Auditor:** Antigravity AI Agent  
**Repository Scope:** `frontend/` (Next.js 16 + React 19) and `backend/` (FastAPI 0.115 + SQLAlchemy 2.0 Asyncio + PostgreSQL 16)  
**Audit Objective:** Perform a read-only audit to identify all frontend mock data sources, disconnected dashboard actions, missing backend endpoints, and missing database models across five core feature areas.

---

## 1. Executive Summary

NyayaSetu's backend possesses robust domain architectures for authentication, advocate verification, case dossiers, deterministic triage, limitation deadlines, private document storage (Cloudflare R2), and statutory legal RAG. 

However, several critical dashboard user workflows remain powered by **client-side mock data arrays** in `frontend/src/data/dashboard-mock-data.ts` and `localStorage`. In some areas (e.g., messaging and appointments), database models exist in PostgreSQL but lack corresponding FastAPI route handlers. In other areas (e.g., DPDP consent records, document OCR/explainer, and consultation feedback), both backend database entities and API endpoints are missing entirely.

### Overall Feature Implementation Health

```
┌─────────────────────────────────┬─────────────────┬───────────────────┬──────────────────────┐
│ Domain Area                     │ Frontend UI     │ Backend Database  │ Live API Integration │
├─────────────────────────────────┼─────────────────┼───────────────────┼──────────────────────┤
│ 1. Dashboard Overview           │ Completed       │ Models Exist      │ ❌ Mock Data (0%)    │
│ 2. Profile & Privacy (DPDP)     │ Completed       │ User Only         │ ❌ LocalStorage (0%) │
│ 3. Document Scanner & Explainer │ Completed       │ Vault Only        │ ❌ Mock Data (0%)    │
│ 4. Advocate Messaging           │ Completed       │ Model Exists      │ ❌ Missing Router(0%)│
│ 5. Advocate Feedback (BCI)      │ Completed       │ Missing           │ ❌ Missing (0%)      │
└─────────────────────────────────┴─────────────────┴───────────────────┴──────────────────────┘
```

---

## 2. Feature-by-Feature Gap Analysis

| Feature Area | Current Frontend Function | Current API Request | Existing Backend Endpoint | Existing Database Model / Table | Data Persists After Refresh / Re-login? | Auth & RBAC Enforced? | Implementation Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **1.1 Dashboard Summary** | `getDashboardSummary()` in `services/dashboard/dashboard.ts` | **None** (`delay(450)` + static imports) | **Missing** (Only separate `/cases`, `/deadlines`, `/appointments` exist) | `LegalCase`, `Deadline`, `Appointment` | ❌ No (Static mock data) | ❌ No | **Simulated (100% Mock)** |
| **1.2 Active Matters Metric** | `summary.activeCases` in `app/dashboard/page.tsx` | **None** | `GET /api/v1/cases` (list) | `LegalCase` (`legal_cases`) | ❌ No | ❌ No | **Simulated** |
| **1.3 Next Limitation Date** | `summary.deadlines[0]` via `daysUntil()` | **None** | `GET /api/v1/deadlines` (list) | `Deadline` (`deadlines`) | ❌ No | ❌ No | **Simulated** |
| **1.4 Unread Messages Count** | `summary.unreadMessages` via `reduce()` | **None** | **Missing** | `CaseMessage` (`case_messages`) | ❌ No | ❌ No | **Simulated** |
| **1.5 Pending Actions Count** | `summary.pendingActions` (hardcoded `2`) | **None** | **Missing** | None | ❌ No | ❌ No | **Simulated** |
| **2.1 Profile Update** | `updateUser({ name, email, city })` via `auth-context.tsx` | **None** (Writes to `localStorage["nyayasetu_user"]`) | **Missing** (`modules/users/router.py` returns `active: False`) | `User` (`users`) | ⚠️ Local to browser only | ❌ No | **Simulated** |
| **2.2 Consent Listing** | `listConsents()` in `services/dashboard/consent.ts` | **None** (Reads `localStorage["legal_consents"]`) | **Missing** | **Missing** (No consent model in DB) | ⚠️ Local to browser only | ❌ No | **Simulated** |
| **2.3 Consent Grant / Revoke** | `saveConsent()`, `revokeConsent()` in `consent.ts` | **None** (Mutates `localStorage["legal_consents"]`) | **Missing** | **Missing** (No consent model in DB) | ⚠️ Local to browser only | ❌ No | **Simulated** |
| **2.4 Data Export (Portability)**| `downloadMyData()` in `services/dashboard/auth.ts` | **None** (Generates client-side synthetic `Blob`) | **Missing** | None (AuditLog exists) | ❌ No (Client generation) | ❌ No | **Simulated** |
| **2.5 Account Erasure (Forget)** | `deleteAccount()` in `services/dashboard/auth.ts` | **None** (Sets `localStorage["legal_deleted"] = "true"`) | **Missing** (No `DELETE /users/me`) | `User` (`users`) | ❌ No (DB record retained) | ❌ No | **Simulated** |
| **3.1 Document OCR Extraction** | `runOcr(fileName)` in `services/dashboard/documents.ts` | **None** (Takes filename, returns static notice text) | **Missing** (No OCR vision pipeline) | None | ❌ No (Static mock string) | ❌ No | **Simulated** |
| **3.2 Document Explanation** | `explainDocument(text)` in `services/dashboard/documents.ts` | **None** (`void text;` returns static notice JSON) | **Missing** (Gemini LLM exists, but no explain route) | None | ❌ No (Static mock JSON) | ❌ No | **Simulated** |
| **3.3 Document Vault Storage** | `storage.upload()`, `storage.getSignedUrl()` | `POST /documents/cases/{id}/upload`, `GET /documents/{id}/access-token` | `POST /documents/cases/{id}/upload`, `GET /documents/{id}/access-token` | `Document` (`documents`) | ✅ Yes (PostgreSQL + R2) | ✅ Yes (JWT Bearer RBAC) | **Real (Production Ready)** |
| **4.1 Message Thread Listing** | `listThreads()` in `services/dashboard/messages.ts` | **None** (Returns mock `threads` array) | **Missing** | `CaseMessage` (`case_messages`) | ❌ No (Static mock data) | ❌ No | **Simulated** |
| **4.2 Conversation History** | `getThreadMessages(threadId)` in `messages.ts` | **None** (Filters mock `advocateChat` array) | **Missing** (No endpoint on `CaseMessage`) | `CaseMessage` (`case_messages`) | ❌ No (Static mock data) | ❌ No | **Simulated** |
| **4.3 Send Case Message** | `sendMessage(threadId, text)` in `messages.ts` | **None** (Returns mock message + auto-reply) | **Missing** | `CaseMessage` (`case_messages`) | ❌ No (Transient React state) | ❌ No | **Simulated** |
| **5.1 Get Consultation Details**| `getBooking(id)` in `services/dashboard/bookings.ts` | Fallback: `GET /api/v1/appointments/{id}` with mock fallback | `GET /api/v1/appointments/{id}` | `Appointment` (`appointments`) | ⚠️ Partial (Falls back to mock) | ⚠️ Partial | **Partially Implemented** |
| **5.2 Submit Advocate Feedback**| `submitFeedback()` in `services/dashboard/messages.ts` | **None** (`delay(700)` + generates `fb_${Date.now()}`) | **Missing** | **Missing** (No feedback/review model in DB) | ❌ No (Transient React state) | ❌ No | **Simulated** |

---

## 3. Deep-Dive Inspection of the 5 Target Areas

### 3.1 Dashboard Overview & Statistics Source

#### Frontend Analysis
* **Files:** [`frontend/src/app/dashboard/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/page.tsx), [`frontend/src/services/dashboard/dashboard.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/dashboard.ts)
* **Execution Flow:** `page.tsx` calls `getDashboardSummary()` on mount.
* **Statistic Source Trace:**
  1. `Active Matters` (`summary.activeCases`): Filters mock array `cases.filter(c => c.status === 'active').length`. Returns `2`.
  2. `Next Limitation Date` (`nextDeadlineLabel`): Takes `summary.deadlines[0]` from mock `deadlines` and calculates `daysUntil(d.date, today)`. Returns `"12 Days"`.
  3. `Advocate Messages` (`summary.unreadMessages`): Aggregates mock thread counters via `threads.reduce((sum, t) => sum + t.unread, 0)`. Returns `2`.
  4. `Pending Actions` (`summary.pendingActions`): Hardcoded literal integer `2`.
  5. `Active Matter Ledger` Card: Reads `summary.recentCase` (`cases[0]`), displaying title *"Security deposit recovery under State Tenancy Act"* with hardcoded stage *"Stage 4 of 5"*, `75%` progress bar, and hardcoded link to `/cases/case_2041/progress`.
  6. `Reviewing Calendar` Badge: Counts `summary.deadlines.filter(d => !d.confirmed).length`.
* **Backend State:**
  * Separate endpoints exist for `GET /api/v1/cases`, `GET /api/v1/deadlines`, and `GET /api/v1/appointments`.
  * **No aggregate endpoint exists** in FastAPI to return the unified dashboard summary in a single round-trip.

---

### 3.2 Profile Dossier, Privacy & DPDP Compliance

#### Frontend Analysis
* **Files:** [`frontend/src/app/dashboard/profile/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/profile/page.tsx), [`frontend/src/services/dashboard/consent.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/consent.ts), [`frontend/src/services/dashboard/auth.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/auth.ts), [`frontend/src/lib/auth-context.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/lib/auth-context.tsx)
* **Execution Flow:**
  1. **Profile Editing:** Submitting "Update Dossier" invokes `updateUser({ name, email, city })` in `auth-context.tsx`. It mutates React state and writes to `localStorage.setItem("nyayasetu_user", ...)`. **Zero network requests are sent to FastAPI.**
  2. **Consent Ledger:** `listConsents()` reads `localStorage.getItem("legal_consents")`. If empty, it initializes with three mock records (`cns_1`, `cns_2`, `cns_3` for dummy user `usr_1024`). `saveConsent()` and `revokeConsent()` manipulate this local storage array.
  3. **Statutory Data Export:** Clicking "Request Signed Archive" executes `downloadMyData()`, which generates a client-side JSON `Blob` containing static mock user data and triggers a synthetic browser file download.
  4. **Right to Erasure:** Clicking "Purge Account" calls `deleteAccount()`, setting `localStorage.setItem("legal_deleted", "true")` and invoking `logout()`. The user record in PostgreSQL remains untouched.
* **Backend State:**
  * `backend/app/modules/users/router.py` is a 10-line skeleton:
    ```python
    @router.get("/status", summary="Users Module Status")
    async def get_users_status():
        return {"module": "users", "status": "initialized", "active": False}
    ```
  * No `PATCH /api/v1/users/me` endpoint exists.
  * No `UserConsent` model or `user_consents` table exists in PostgreSQL.
  * No data export (`GET /api/v1/users/me/export`) endpoint exists.
  * No account deletion (`DELETE /api/v1/users/me`) endpoint exists.
* **Legal & Regulatory Risks:**
  * Violation of **Digital Personal Data Protection Act, 2023 (DPDP)**:
    - Section 6 mandates that data fiduciaries maintain verifiable, auditable records of consent grants, purposes, and withdrawals.
    - Section 11 grants data principals the statutory right to access and export their personal data.
    - Section 12 grants data principals the statutory right to erasure (right to be forgotten).
  * Storing consent records solely in the citizen's browser local storage provides zero audit defense under Indian law.

---

### 3.3 Document Scanner & Explainer Pipeline

#### Frontend Analysis
* **Files:** [`frontend/src/app/dashboard/scan/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/scan/page.tsx), [`frontend/src/services/dashboard/documents.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/documents.ts)
* **Execution Flow:**
  1. The citizen selects an image or PDF.
  2. `scan/page.tsx` creates a preview URL: `URL.createObjectURL(file)`.
  3. `process(file.name, url)` calls `runOcr(file.name)`.
  4. `runOcr` completely ignores the file contents. It only inspects the filename string using regex (`/blur|photo|scan|receipt/i`), sleeps for 1000ms, and returns a hardcoded 180-word legal demand notice to *"Mr. S. Rao for ₹60,000 security deposit"*.
  5. The UI calls `explainDocument(result.text)`. `explainDocument` starts with `void text;`, completely ignores the text, sleeps for 800ms, and returns a hardcoded JSON summary regarding a landlord-tenant security deposit dispute.
* **Backend State:**
  * `backend/app/modules/documents/` has an industrial-grade secure vault with Cloudflare R2 object storage, magic byte validation, and presigned URLs.
  * `backend/app/modules/legal_assistant/llm_provider.py` has a production-ready `GeminiLLMProvider` connected to Google Gemini.
  * **Missing Connection:** No endpoint exists on the backend to ingest document file bytes, execute OCR text extraction, or pass extracted text to Gemini for structured entity extraction (dates, amounts, obligations, parties).
* **Definitive Answer:**
  * **Uploaded file bytes NEVER reach any OCR or explanation service.** They remain trapped in the browser's temporary object URL.

---

### 3.4 Advocate Messaging & Case Communications

#### Frontend Analysis
* **Files:** [`frontend/src/app/dashboard/messages/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/messages/page.tsx), [`frontend/src/services/dashboard/messages.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/messages.ts)
* **Execution Flow:**
  1. `listThreads()` returns static `threads` from `@/data/dashboard-mock-data.ts`.
  2. `getThreadMessages(threadId)` filters static `advocateChat` mock items.
  3. `sendMessage(threadId, text)` appends an in-memory message object, simulates a 400ms delay, and synthesizes a hardcoded advocate auto-reply (*"Received. I will review this and get back to you by the end of the day."*).
  4. `reportUser()`, `blockAdvocate()`, and `callMaskedNumber()` execute mock delays and log to `console.info`.
* **Backend State:**
  * **Database Model Exists:** `CaseMessage` in [`backend/app/modules/cases/models.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/modules/cases/models.py#L195-L246) maps table `case_messages`:
    - `id UUID PRIMARY KEY`
    - `case_id UUID REFERENCES legal_cases.id`
    - `sender_id UUID REFERENCES users.id`
    - `sender_role VARCHAR(32)` (`CLIENT`, `ADVOCATE`, `AI_ASSISTANT`, `SYSTEM`)
    - `message_text TEXT`
    - `is_privileged BOOLEAN` (Protected under Bharatiya Sakshya Adhiniyam, 2023 §126–129)
    - `metadata_json JSONB`
    - `created_at TIMESTAMP WITH TIME ZONE`
  * **Missing API Router:** `backend/app/modules/cases/router.py` does **NOT** expose:
    - `GET /cases/{case_id}/messages` (to retrieve conversation history)
    - `POST /cases/{case_id}/messages` (to persist and broadcast messages)
    - Message thread listing or unread count endpoints.
* **Persistence:** **Zero persistence.** All messages exist only in ephemeral React state and are wiped upon navigating away or refreshing the page.

---

### 3.5 Advocate Consultation Feedback & Quality Assurance

#### Frontend Analysis
* **Files:** [`frontend/src/app/dashboard/feedback/[bookingId]/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/feedback/[bookingId]/page.tsx), [`frontend/src/services/dashboard/messages.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/messages.ts)
* **Execution Flow:**
  1. The page loads `bookingId` from URL route parameters and calls `getBooking(bookingId)`.
  2. In `services/dashboard/bookings.ts`, `getBooking(id)` has a fallback: `mockBookings.find(b => b.id === id) ?? mockBookings[0]`. Because `mockBookings[0]` has `status = "completed"`, the feedback form unlocks for any arbitrary string passed in the URL.
  3. The citizen selects a 1–5 star statutory grade, tags (e.g. *"Clear communication"*, *"Punctual & prepared"*), comments, and resolution status (*"Substantially Resolved"*, *"Filing in Progress"*, *"Unresolved"*).
  4. Clicking "Transmit Verified Evaluation" calls `submitFeedback(...)` in `messages.ts`.
  5. `submitFeedback` simply waits 700ms and returns `{ ...entry, id: 'fb_' + Date.now(), createdAt: new Date().toISOString() }`.
* **Backend State:**
  * `backend/app/modules/appointments/models.py` defines `Appointment` with status `COMPLETED`.
  * `backend/app/modules/advocates/models.py` defines `AdvocateProfile`.
  * **Missing Backend Entities:**
    - There is **no Feedback / Review entity or database table** in PostgreSQL.
    - There is **no API endpoint** (e.g. `POST /api/v1/appointments/{id}/feedback`) to submit or list feedback.
* **Verification & Security Gaps:**
  * **Booking Ownership Not Verified:** Any user can submit feedback for any booking ID without backend authorization.
  * **Completion Not Verified:** The backend does not verify whether the consultation session occurred or was marked `COMPLETED`.
  * **Bar Council of India (BCI) Rule 36 Compliance:**
    - Advocates are strictly prohibited from advertising or promoting subjective commercial ratings.
    - Evaluation must be strictly private, non-commercial quality assurance metrics collected only after verified completion of a booked consultation, with zero public promotional scoreboards.

---

## 4. Affected Files Matrix

```
NyayaSetu/
├── frontend/
│   ├── src/app/dashboard/
│   │   ├── page.tsx                           [MODIFY: Replace mock getDashboardSummary with real API call]
│   │   ├── profile/page.tsx                   [MODIFY: Connect dossier updates, consent, export & deletion]
│   │   ├── scan/page.tsx                      [MODIFY: Send actual file bytes to backend OCR & explainer]
│   │   ├── messages/page.tsx                  [MODIFY: Connect to backend CaseMessage endpoints]
│   │   └── feedback/[bookingId]/page.tsx      [MODIFY: Connect to verified appointment feedback API]
│   ├── src/services/dashboard/
│   │   ├── dashboard.ts                       [REPLACE MOCK: Fetch from /api/v1/dashboard/summary]
│   │   ├── consent.ts                         [REPLACE MOCK: Connect to /api/v1/users/me/consents]
│   │   ├── auth.ts                            [REPLACE MOCK: Connect deleteAccount & downloadMyData to backend]
│   │   ├── documents.ts                       [REPLACE MOCK: Connect runOcr & explainDocument to backend]
│   │   ├── messages.ts                        [REPLACE MOCK: Connect listThreads, getThreadMessages, sendMessage]
│   │   └── bookings.ts                        [REMOVE FALLBACKS: Enforce real appointment verification]
│   └── src/lib/
│       └── auth-context.tsx                   [MODIFY: Update user profile via PATCH /api/v1/users/me]
└── backend/
    ├── app/
    │   ├── api/v1/
    │   │   └── router.py                      [UPDATE: Register new dashboard, users, and feedback routers]
    │   └── modules/
    │       ├── users/
    │       │   ├── router.py                  [EXPAND: Implement /me, /me/consents, /me/export, DELETE /me]
    │       │   ├── schemas.py                 [CREATE: UserUpdate, ConsentCreate, ConsentResponse, ExportResponse]
    │       │   ├── service.py                 [CREATE: Profile update, DPDP consent tracking, export, soft delete]
    │       │   └── models.py                  [UPDATE: Add UserConsent entity and relationship]
    │       ├── cases/
    │       │   ├── router.py                  [EXPAND: Add GET/POST /cases/{case_id}/messages]
    │       │   ├── schemas.py                 [EXPAND: Add MessageCreateRequest, MessageResponse, ThreadResponse]
    │       │   └── service.py                 [EXPAND: Implement send_case_message and list_case_messages]
    │       ├── documents/
    │       │   ├── router.py                  [EXPAND: Add POST /documents/scan and POST /documents/explain]
    │       │   ├── schemas.py                 [EXPAND: Add DocumentScanResponse, DocumentExplainResponse]
    │       │   └── service.py                 [EXPAND: Indic OCR text extraction & Gemini entity extraction]
    │       ├── appointments/
    │       │   ├── router.py                  [EXPAND: Add POST/GET /appointments/{id}/feedback]
    │       │   ├── schemas.py                 [EXPAND: Add AppointmentFeedbackCreate, FeedbackResponse]
    │       │   ├── service.py                 [EXPAND: Ownership & completed-status verification for feedback]
    │       │   └── models.py                  [UPDATE: Add AppointmentFeedback entity and relationship]
    │       └── dashboard/                     [NEW DOMAIN MODULE]
    │           ├── __init__.py
    │           ├── router.py                  [NEW: GET /api/v1/dashboard/summary]
    │           ├── schemas.py                 [NEW: DashboardSummaryResponse]
    │           └── service.py                 [NEW: Aggregate active matters, next deadline, unread messages]
    └── migrations/versions/
        └── 0012_dpdp_consents_and_feedback.py [NEW MIGRATION: user_consents, appointment_feedback tables]
```

---

## 5. Missing Backend Endpoints Specification

### 1. Dashboard Overview Module (`/api/v1/dashboard`)
* `GET /api/v1/dashboard/summary`
  * **Auth:** Bearer JWT (Role: `CITIZEN` or `ADVOCATE`).
  * **Response:**
    ```json
    {
      "active_cases": 2,
      "unread_messages": 0,
      "pending_actions": 1,
      "next_deadline": {
        "id": "uuid",
        "title": "Section 138 Notice Expiry",
        "due_date": "2026-12-04T00:00:00Z",
        "days_remaining": 12,
        "is_confirmed": true
      },
      "recent_case": {
        "id": "uuid",
        "case_reference": "NYA-2026-CS-8421",
        "title": "Security deposit recovery under State Tenancy Act",
        "category": "Tenancy & Rent",
        "stage": "PRE_FILING",
        "updated_at": "2026-11-20T14:30:00Z"
      },
      "deadlines": []
    }
    ```

### 2. User Profile & DPDP Compliance Module (`/api/v1/users`)
* `PATCH /api/v1/users/me` — Update legal name, official email, jurisdictional city/district, and language preference.
* `GET /api/v1/users/me/consents` — List active and revoked DPDP consent grants for the authenticated citizen.
* `POST /api/v1/users/me/consents` — Record a new explicit consent grant (Terms, Privacy, DPDP, Document Sharing).
* `PATCH /api/v1/users/me/consents/{consent_id}/revoke` — Cryptographically record consent revocation pursuant to DPDP Act §6(4).
* `GET /api/v1/users/me/export` — Generate and stream a complete, signed JSON export of the citizen's personal dossier, uploaded document hashes, case records, and audit events under DPDP Act §11.
* `DELETE /api/v1/users/me` — Right to erasure (DPDP Act §12): Soft-delete user profile, terminate all refresh tokens, anonymize personal telemetry, and mark vault holdings for scheduled purge.

### 3. Document Scanner & Explainer Module (`/api/v1/documents`)
* `POST /api/v1/documents/scan`
  * **Payload:** `multipart/form-data` with `file: UploadFile`.
  * **Operation:** Extracts raw statutory text from scanned legal notices, summons, court orders, or agreements using Indic-optimized OCR / PDF parsing.
  * **Response:** `{ "extracted_text": "...", "confidence_score": 0.94, "is_low_confidence": false }`.
* `POST /api/v1/documents/explain`
  * **Payload:** `{ "text": "...", "language": "en" }`.
  * **Operation:** Dispatches extracted text to `GeminiLLMProvider` using structured system prompts to identify document type, opposing parties, limitation deadlines, monetary demands, and statutory obligations.
  * **Response:** Structured `DocumentExplanation` model matching frontend UI expectations.

### 4. Case Messaging Module (`/api/v1/cases`)
* `GET /api/v1/cases/{case_id}/messages` — Paginated list of privileged communications under BSA 2023 §126–129. Enforces client/assigned advocate ownership.
* `POST /api/v1/cases/{case_id}/messages` — Post new message (with optional evidence document attachment reference).
* `GET /api/v1/cases/messages/threads` — Aggregate message threads across all active cases for the authenticated user with unread counts.

### 5. Verified Consultation Feedback Module (`/api/v1/appointments`)
* `POST /api/v1/appointments/{appointment_id}/feedback`
  * **Auth:** Bearer JWT (`current_user.id == appointment.client_id`).
  * **Pre-condition:** `appointment.status == 'COMPLETED'`.
  * **Payload:** `{ "rating": 5, "tags": [...], "comment": "...", "resolved_status": "in_progress" }`.
  * **Operation:** Persists evaluation in `appointment_feedback` table. Computes private quality aggregates.
* `GET /api/v1/appointments/{appointment_id}/feedback` — Retrieve existing feedback for verification.

---

## 6. Missing Database Models & Alembic Migration Specification

A forward Alembic migration (`0012_dpdp_consents_and_feedback.py`) must introduce two new entities:

### 1. `UserConsent` Entity (`user_consents` table)
```python
class UserConsent(Base, TimestampMixin):
    __tablename__ = "user_consents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    consent_type: Mapped[str] = mapped_column(String(64), nullable=False, comment="TERMS | PRIVACY | DPDP | SHARE_BRIEF | SHARE_DOCUMENTS")
    version: Mapped[str] = mapped_column(String(16), nullable=False, default="1.0")
    purpose: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    advocate_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("advocate_profiles.id", ondelete="SET NULL"), nullable=True)
    items_shared: Mapped[Optional[List[str]]] = mapped_column(JSONB().with_variant(JSON, "sqlite"), nullable=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
```

### 2. `AppointmentFeedback` Entity (`appointment_feedback` table)
```python
class AppointmentFeedback(Base, TimestampMixin):
    __tablename__ = "appointment_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    advocate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("advocate_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False, comment="Statutory rating from 1 to 5")
    tags: Mapped[Optional[List[str]]] = mapped_column(JSONB().with_variant(JSON, "sqlite"), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_status: Mapped[str] = mapped_column(String(32), default="in_progress", nullable=False, comment="yes | no | in_progress")
```

---

## 7. Security, Privacy & Regulatory Compliance Risks

1. **Digital Personal Data Protection Act, 2023 (DPDP) Non-Compliance:**
   * Consent records and revocations currently exist exclusively in browser `localStorage`. If a user logs in from a different browser or clears website data, all consent preferences and revocation timestamps are lost.
   * Under Section 6 and 8 of DPDP, NyayaSetu must prove explicit consent for data processing and maintain timestamped, IP-logged audit trails.
2. **Bar Council of India (BCI) Rule 36 Violations:**
   * Commercial promotional leaderboards or solicitous advocate ratings violate Rule 36.
   * Feedback must be verified by confirming that the client actually booked and completed a consultation with that specific advocate (`appointment.status == 'COMPLETED'`). Unrestricted feedback forms represent a compliance hazard.
3. **Bharatiya Sakshya Adhiniyam, 2023 (BSA) Sections 126–129 (Advocate-Client Privilege):**
   * Case communications between citizens and advocates are privileged legal documents.
   * Currently, messages are not persisted in the database, leaving no legal trail for court hearings, notices, or advisory records.
4. **Data Portability & Erasure Absence:**
   * Generating client-side mock export blobs does not fulfill statutory data portability mandates. Server-side archives must cryptographically aggregate all matter documents, docket filings, and audit logs.

---

## 8. Recommended Implementation Sequence & Dependencies

```mermaid
flowchart TD
    subgraph Phase 1: Database & Core Models
        M1[Create Alembic Migration 0012: user_consents & appointment_feedback]
        M2[Implement SQLAlchemy Models in modules/users & modules/appointments]
    end

    subgraph Phase 2: Backend APIs
        B1[Implement Profile, Consent, Export & Deletion in modules/users]
        B2[Implement Case Messaging Routes in modules/cases]
        B3[Implement Appointment Feedback Route in modules/appointments]
        B4[Implement Document Scan & Explain Routes in modules/documents]
        B5[Implement Consolidated GET /api/v1/dashboard/summary in modules/dashboard]
    end

    subgraph Phase 3: Frontend Client Integration
        F1[Connect Dashboard Summary to /api/v1/dashboard/summary]
        F2[Connect Profile, Consent & Deletion to /api/v1/users/me]
        F3[Connect Document Scanner to /api/v1/documents/scan & explain]
        F4[Connect Messages to /api/v1/cases/{id}/messages]
        F5[Connect Consultation Feedback to /api/v1/appointments/{id}/feedback]
    end

    M1 --> M2
    M2 --> B1
    M2 --> B3
    M1 --> B2
    B1 --> F2
    B2 --> F4
    B3 --> F5
    B4 --> F3
    B5 --> F1
```

### Step-by-Step Execution Plan

1. **Step 1: Database Migration (Phase 1)**
   * Create Alembic revision `0012_dpdp_consents_and_feedback.py`.
   * Define `UserConsent` in `backend/app/modules/users/models.py`.
   * Define `AppointmentFeedback` in `backend/app/modules/appointments/models.py`.
   * Apply migration via `alembic upgrade head`.

2. **Step 2: User Profile, Privacy & DPDP Endpoints (Phase 2A)**
   * Implement `PATCH /api/v1/users/me` to update legal name, email, and language.
   * Implement `GET /api/v1/users/me/consents`, `POST /api/v1/users/me/consents`, and `PATCH /api/v1/users/me/consents/{id}/revoke`.
   * Implement `GET /api/v1/users/me/export` (signed JSON archive of user profile, case summaries, audit logs).
   * Implement `DELETE /api/v1/users/me` (soft delete and token purge).

3. **Step 3: Privileged Case Messaging Endpoints (Phase 2B)**
   * Implement `GET /api/v1/cases/{case_id}/messages` and `POST /api/v1/cases/{case_id}/messages` in `backend/app/modules/cases/`.
   * Implement `GET /api/v1/cases/messages/threads` to return conversation threads with unread counts.

4. **Step 4: Document OCR & Explanation Pipeline (Phase 2C)**
   * Implement `POST /api/v1/documents/scan` in `backend/app/modules/documents/`: extracts text from uploaded PDF/image bytes using text extraction / OCR.
   * Implement `POST /api/v1/documents/explain`: dispatches extracted text to `GeminiLLMProvider` for structured legal entity breakdown.

5. **Step 5: Verified Appointment Feedback API (Phase 2D)**
   * Implement `POST /api/v1/appointments/{appointment_id}/feedback`:
     * Strictly verifies `appointment.client_id == current_user.id`.
     * Strictly verifies `appointment.status == 'COMPLETED'`.
     * Rejects duplicate reviews (`409 Conflict`).

6. **Step 6: Consolidated Dashboard Summary API (Phase 2E)**
   * Create `backend/app/modules/dashboard/` with `GET /api/v1/dashboard/summary`.
   * Efficiently aggregates active cases count, next limitation deadline, unread case messages, and latest case docket.

7. **Step 7: Frontend Dashboard Services Refactoring (Phase 3)**
   * Refactor `dashboard.ts` to call `GET /api/v1/dashboard/summary`.
   * Refactor `consent.ts` and `auth.ts` to call backend `/api/v1/users/me` endpoints.
   * Refactor `documents.ts` (`runOcr`, `explainDocument`) to send file bytes to `/api/v1/documents/scan` and `/api/v1/documents/explain`.
   * Refactor `messages.ts` to fetch and post real messages from `/api/v1/cases/{id}/messages`.
   * Refactor `feedback/[bookingId]/page.tsx` to submit verified evaluations to `/api/v1/appointments/{id}/feedback`.
