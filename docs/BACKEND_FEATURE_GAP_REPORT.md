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
