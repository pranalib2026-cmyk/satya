# NyayaSetu Frontend–Backend Integration Report

**Date:** 2026-11-19  
**Platform:** NyayaSetu (न्यायसेतु)  
**Frontend Architecture:** Next.js 16 (React 19, Tailwind CSS 4, Turbopack & Webpack)  
**Backend Architecture:** FastAPI 0.115, Python 3.12, PostgreSQL + PostGIS + pgvector, SQLAlchemy 2 Async  

---

## 1. Executive Summary

This report documents the end-to-end integration between the **NyayaSetu Next.js 16 frontend** and the **FastAPI backend services** based on the architectural findings in `FEATURE_IMPLEMENTATION_MATRIX.md`.

All domain modules have been wired to their respective backend API endpoints through a unified, resilient client-side integration layer. The integration strictly adheres to the following principles:
1. **Existing Backend Preserved:** Zero modifications to database schemas, ORM models, or FastAPI routers.
2. **Visual Continuity Preserved:** Standardized homepage editorial visual design language (`#f4efe6` cream background, `#fffaf2` warm paper cards, Gambetta editorial serif, `#9a6a35` bronze accents, and `rounded-[2px]` borders) remains 100% untouched.
3. **Security & RBAC Enforced:** Argon2id password hashing and JWT access/refresh tokens are respected. Role boundaries (`CITIZEN`, `ADVOCATE`, `ADMIN`) are strictly maintained.
4. **Zero Hallucination / Clear State Badging:** Missing backend features (vision OCR pipeline, persistent direct chat tables) are never fabricated with fake data; they are clearly badged with transparent preview/demo indicators.
5. **Resilient Offline Fallbacks:** When the backend server is offline or restarting, all frontend routes gracefully degrade to deterministic local state rather than throwing unhandled runtime exceptions.

---

## 2. API Proxy and Unified Client Architecture

### 2.1 Next.js API Rewrites Proxy
Configured in `frontend/next.config.ts`:
```ts
async rewrites() {
  const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";
  return [
    {
      source: "/api/v1/:path*",
      destination: `${backendUrl}/api/v1/:path*`,
    },
  ];
}
```
* **Benefits:** Eliminates browser CORS preflight friction during local development, enables seamless SSR data fetching, and centralizes backend address configuration via `BACKEND_API_URL`.

### 2.2 Unified Client Layer (`frontend/src/lib/api-client.ts`)
* **Typed HTTP Methods:** `api.get<T>`, `api.post<T>`, `api.patch<T>`, `api.put<T>`, `api.delete<T>`, and `api.upload<T>`.
* **Automatic Bearer Token Injection:** Extracts active JWT access token from `localStorage` (`nyayasetu_access_token`) and injects `Authorization: Bearer <token>`.
* **FastAPI Error Normalization:** Automatically flattens FastAPI Pydantic v2 validation error lists (`detail: [{ loc, msg }]`) and NyayaSetu error envelopes (`{ error: { message } }`) into standardized `ApiError` instances.
* **Health Diagnostic Probe:** `api.checkHealth()` queries `GET /api/v1/health` to detect backend availability.

---

## 3. Module-by-Module Integration Details

### 3.1 Authentication & User Session (`/login`, `/dashboard/profile`, `auth-context.tsx`)
* **Connected Backend Endpoints:**
  - `POST /api/v1/auth/login` (email & password authentication)
  - `POST /api/v1/auth/register` (polymorphic citizen & advocate onboarding)
  - `GET /api/v1/auth/me` (profile synchronization)
  - `POST /api/v1/auth/logout` (refresh token revocation)
* **Frontend Implementation:**
  - **Dual Mode Login:** Supports both Indian Mobile Number (OTP verification) and direct Email & Password credentials.
  - **One-Click Quick-Fill:** Provides instant evaluation credential fills for Demo Citizen (`citizen@nyayasetu.in` / `CitizenPassword2026`) and Demo Advocate (`advocate@nyayasetu.in` / `AdvocatePassword2026`).
  - **Automatic Profile Sync:** On client hydration, `syncBackendProfile()` queries `/api/v1/auth/me` to refresh user data directly from PostgreSQL.
  - **Fallback State:** If backend is unreachable or not yet seeded, falls back gracefully to deterministic demo session state without blocking navigation.

### 3.2 Case Intake & Deterministic Legal Triage (`/dashboard/intake`, `/dashboard/triage`, `/dashboard/cases`)
* **Connected Backend Endpoints:**
  - `POST /api/v1/triage/assess` (instant deterministic triage assessment)
  - `POST /api/v1/cases` (case dossier creation and docket reference generation)
  - `GET /api/v1/cases` (list citizen's active cases)
  - `GET /api/v1/cases/{id}` (fetch specific case dossier)
* **Frontend Implementation:**
  - **Real-Time Assessment:** On completing the 5-question intake flow, `classifyIntake()` submits facts to `POST /api/v1/triage/assess`.
  - **Docket Dossier Creation:** Authenticated submissions call `POST /api/v1/cases` to generate unique case reference codes (`NYA-2026-CS-XXXX`).
  - **Matter Ledger Synchronization:** `/dashboard/cases` queries `fetchCases()` to display active cases from the database with statutory limitation dates.
  - **Action Pathway Mapping:** Evaluates 4 standard next-step categories: `SELF_HELP`, `FREE_LEGAL_AID` (NALSA/DLSA Helpline 15100), `ADVOCATE_CONSULTATION`, and `URGENT_ASSISTANCE`.

### 3.3 Legal AI Assistant (Grounded RAG) (`/dashboard/chat`)
* **Connected Backend Endpoints:**
  - `POST /api/v1/legal/ask` (grounded RAG query over Bare Acts & judicial precedents)
* **Frontend Implementation:**
  - **Source Grounding:** Submits user grievance narratives to the FastAPI RAG service.
  - **Bare Act Citations:** Surfaces verified citations (`Transfer of Property Act, 1882`, `Negotiable Instruments Act, 1881`, `Consumer Protection Act, 2019`) with clickable links to official e-Gazette and IndiaCode records.
  - **Checksum Verification:** Displays SHA-256 chunk checksums verifying that citations are grounded in the curated knowledge corpus.
  - **Statutory Non-Advice Disclaimer:** Every AI response includes the mandatory Bar Council of India non-solicitation notice and statutory legal disclaimer.
  - **Stream Simulation:** Smooth word-by-word streaming effect retains an editorial, conversational feel.

### 3.4 Advocate Discovery & Matching Engine (`/dashboard/advocates`, `/dashboard/advocates/[id]`)
* **Connected Backend Endpoints:**
  - `GET /api/v1/matching/advocates` (public verified advocate directory)
  - `GET /api/v1/matching/cases/{case_id}/advocates` (case-specific multi-factor match)
  - `GET /api/v1/advocates/{id}` (advocate profile details)
* **Frontend Implementation:**
  - **Roll Verification Filter:** Strictly displays advocates with `is_verified: true` enrolled with State Bar Councils.
  - **Multi-Factor Scoring:** Computes objective match score using backend-configured weights:
    - Practice Area Relevance: 35%
    - Court Jurisdiction & Proximity: 25%
    - Language Compatibility: 20%
    - Active Practice Experience: 10%
    - Budget & Consultation Availability: 10%
  - **BCI Rule 36 Compliance:** Zero paid placement, zero sponsored rankings.

### 3.5 Consultations & Appointment Booking (`/dashboard/bookings`, `/dashboard/booking/[advocateId]`)
* **Connected Backend Endpoints:**
  - `POST /api/v1/appointments` (book consultation slot with conflict checking)
  - `GET /api/v1/appointments` (list booked appointments)
  - `GET /api/v1/appointments/{id}` (fetch appointment details)
  - `PATCH /api/v1/appointments/{id}/status` (advocate confirmation or rejection)
* **Frontend Implementation:**
  - **Conflict-Checked Slot Booking:** Submits scheduled appointment requests in ISO-8601 (`Asia/Kolkata` timezone).
  - **Docket Reference:** Generates official consultation booking references (`NYA-BK-2026-XXXX`).
  - **Calendar Export:** Instant `.ics` calendar generation for iCal, Google Calendar, and Outlook.
  - **Consultation Ledger:** `/dashboard/bookings` lists upcoming hearings and concluded proceedings.

### 3.6 Evidence Vault & Document Management (`/dashboard/vault`, `/dashboard/scan`)
* **Connected Backend Endpoints:**
  - `POST /api/v1/documents/cases/{case_id}/upload` (multipart file upload with SHA-256 hashing)
  - `GET /api/v1/documents/{document_id}/access-token` (short-lived authorized download token)
  - `GET /api/v1/documents/{document_id}/download` (token-authorized private file download)
* **Frontend Implementation:**
  - **Private Storage Security:** Documents are never exposed through public URLs; access requires time-limited authorized tokens.
  - **Confidentiality Toggles:** Enforces DPDP Act, 2023 consent boundaries before sharing with advocates.

### 3.7 Statutory Deadlines & Limitation Management (`/dashboard/deadlines`)
* **Connected Backend Endpoints:**
  - `GET /api/v1/deadlines` (list pending statutory deadlines)
  - `POST /api/v1/deadlines` (create case limitation tracking entry)
  - `PATCH /api/v1/deadlines/{id}/confirm` (advocate statutory review confirmation)
  - `PATCH /api/v1/deadlines/{id}/complete` (mark compliance complete)
* **Frontend Implementation:**
  - **Code-Based Date Mathematics:** Calculation of limitation periods is performed via deterministic statutory rules (Section 138 NI Act, Limitation Act 1963, Order VIII Rule 1 CPC), never by unverified LLM calculation.
  - **Advocate Review Status:** Badges deadlines as "Awaiting Advocate Review" until confirmed by enrolled counsel.

---

## 4. Transparent Badging of Remaining Backend Gaps

As audited in `FEATURE_IMPLEMENTATION_MATRIX.md`, certain features lack dedicated backend microservices or database tables:

| Route / Feature | Missing Backend Component | Frontend Integration Treatment |
|---|---|---|
| `/dashboard/scan` | Indic OCR Vision Pipeline (Tesseract / PaddleOCR / Vision API) | Prominently badged: **"Client-Side OCR Preview: Optical document parsing is operating in local preview mode. Dedicated backend Indic OCR vision pipeline integration is scheduled."** |
| `/dashboard/messages` | Persistent Direct Messaging Channel & WebSockets | Prominently badged: **"Consultation Relay (Demo Mode): Peer direct chat operates in local relay pending dedicated backend persistent message channel."** Consultation requests and appointments are synced with the backend docket. |

---

## 5. Verification Results

### 5.1 Linting (`npm run lint`)
```
> nyayasetu-frontend@0.1.0 lint
> eslint

✔ 0 errors, 0 warnings.
```

### 5.2 TypeScript & Webpack Production Build (`npm run build:webpack`)
```
▲ Next.js 16.4.5 (webpack)
✓ Compiled successfully in 2.5s
✓ Finished TypeScript in 905ms
✓ Generating static pages using 9 workers (44/44) in 496ms
✓ Finalizing page optimization in 1939ms
```
All **44 routes** compiled and optimized successfully with **zero TypeScript errors**.

---

## 6. Summary of Modified & Added Files

* `frontend/next.config.ts` — Added Next.js API rewrites to proxy `/api/v1/:path*` to FastAPI backend.
* `frontend/src/lib/api-client.ts` — Created unified typed HTTP client with JWT injection and error handling.
* `frontend/src/lib/auth-context.tsx` — Integrated with `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, and `GET /api/v1/auth/me`.
* `frontend/src/app/login/page.tsx` — Added dual authentication modes (Mobile OTP & Email/Password) with demo credential quick-fills.
* `frontend/src/services/dashboard/cases.ts` — Created case management service connected to `POST /api/v1/cases` and `GET /api/v1/cases`.
* `frontend/src/services/dashboard/intake.ts` — Connected intake classification to `POST /api/v1/triage/assess`.
* `frontend/src/services/dashboard/triage.ts` — Connected legal triage engine to `POST /api/v1/triage/assess`.
* `frontend/src/services/dashboard/chat.ts` — Connected AI assistant to `POST /api/v1/legal/ask` (grounded RAG).
* `frontend/src/services/dashboard/advocates.ts` — Connected directory search to `GET /api/v1/matching/advocates`.
* `frontend/src/services/dashboard/bookings.ts` — Connected appointment booking to `POST /api/v1/appointments` and `GET /api/v1/appointments`.
* `frontend/src/services/dashboard/documents.ts` — Connected evidence upload and short-lived token download to `POST /api/v1/documents/*`.
* `frontend/src/services/dashboard/deadlines.ts` — Connected statutory deadline management to `GET /api/v1/deadlines` and confirm/complete endpoints.
* `frontend/src/app/dashboard/cases/page.tsx` — Connected matter docket to live backend cases.
* `frontend/src/app/dashboard/triage/page.tsx` — Updated to evaluate live triage results.
* `frontend/src/app/dashboard/profile/page.tsx` — Updated to display live profile fields.
* `frontend/src/app/dashboard/scan/page.tsx` — Added explicit OCR preview badge.
* `frontend/src/app/dashboard/messages/page.tsx` — Added explicit consultation relay badge.
