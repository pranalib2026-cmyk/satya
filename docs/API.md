# API Specification & Endpoint Contract — NyayaSetu API v1

**Base URL:** `http://localhost:8000/api/v1`  
**Standard Port:** 8000  
**Format:** JSON (`application/json`)  
**Authentication Scheme:** HTTP Bearer JWT (`Authorization: Bearer <access_token>`)  

---

## 1. System Health & Diagnostics

### `GET /api/v1/health`
Probes API server liveness, PostgreSQL database latency, and system version.
* **Authentication:** Public
* **Request:** None
* **Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "NyayaSetu Backend API",
  "version": "0.1.0",
  "environment": "development",
  "database": {
    "status": "connected",
    "latency_ms": 2.14
  }
}
```
* **Error (503 Service Unavailable):** If database connection times out or fails.

---

## 2. Authentication & Session Module (`/auth`)

### `POST /api/v1/auth/register`
Registers a new citizen or universal user. Self-assignment of `ADMIN` role is blocked.
* **Authentication:** Public
* **Request Body:**
```json
{
  "account_type": "CITIZEN",
  "full_name": "Aarav Sharma",
  "email": "aarav.sharma@example.com",
  "phone": "+919876543210",
  "password": "SecurePassword123",
  "preferred_language": "hi"
}
```
* **Response (201 Created):**
```json
{
  "id": "e4b2d5f0-6a12-4d89-b22c-8d1976bcf129",
  "email": "aarav.sharma@example.com",
  "phone": "+919876543210",
  "full_name": "Aarav Sharma",
  "role": "CITIZEN",
  "is_verified": false,
  "is_active": true,
  "preferred_language": "hi",
  "created_at": "2026-11-20T10:00:00Z"
}
```
* **Error Responses:**
  * `409 Conflict`: Email or phone already registered.
  * `422 Unprocessable Entity`: Password < 8 characters or invalid format.

---

### `POST /api/v1/auth/register/advocate`
Dedicated registration endpoint for legal practitioners with mandatory Bar Council credentials.
* **Authentication:** Public
* **Request Body:**
```json
{
  "full_name": "Adv. Rajeshwari Sen",
  "email": "r.sen@nyayasetu.in",
  "phone": "+919811223344",
  "password": "LegalPassword2026",
  "bar_council_id": "D/1234/2006",
  "bar_council_name": "Bar Council of Delhi",
  "in_practice_years": 18,
  "primary_practice": "Trials & Disputes",
  "city": "New Delhi",
  "state": "Delhi"
}
```
* **Response (201 Created):** Returns user profile with `role: "ADVOCATE"`.

---

### `POST /api/v1/auth/login`
Authenticates via Argon2id password verification and issues JWT access and refresh tokens.
* **Authentication:** Public
* **Request Body:**
```json
{
  "email": "citizen@nyayasetu.in",
  "password": "CitizenPassword2026"
}
```
* **Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "usr_9988-uuid",
    "email": "citizen@nyayasetu.in",
    "phone": "+919876543210",
    "full_name": "Priya Sharma",
    "role": "CITIZEN",
    "is_verified": true,
    "is_active": true,
    "preferred_language": "en",
    "created_at": "2026-11-17T15:00:00Z"
  }
}
```
* **Error Responses:**
  * `401 Unauthorized`: Invalid email or password.
  * `403 Forbidden`: Account deactivated.

---

### `POST /api/v1/auth/refresh`
Rotates an existing refresh token, revoking the old token and returning a new keypair.
* **Authentication:** Public
* **Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsIn..."
}
```
* **Response (200 OK):** Returns new `access_token` and rotated `refresh_token`.

---

### `POST /api/v1/auth/logout`
Revokes active refresh token and invalidates the user's active session.
* **Authentication:** Bearer JWT required
* **Request Body:** Optional `{"refresh_token": "..."}`
* **Response (200 OK):** `{"success": true, "message": "Successfully logged out."}`

---

### `GET /api/v1/auth/me`
Retrieves authenticated profile of the token bearer.
* **Authentication:** Bearer JWT required
* **Response (200 OK):** Returns `UserResponse` object.

---

## 3. Case Docket & Intake Module (`/cases`)

### `POST /api/v1/cases`
Submits a citizen grievance. Generates unique docket code (`NYA-2026-CS-XXXX`) and automatically executes deterministic legal triage.
* **Authentication:** Bearer JWT (`CITIZEN` or `ADMIN`)
* **Request Body:**
```json
{
  "title": "Unlawful Retention of Commercial Lease Deposit",
  "problem_description": "Landlord refused to return ₹1,50,000 security deposit after complete commercial premises handover on 15 Oct 2026.",
  "legal_issue_category": "Property & Tenancy Disputes",
  "state": "Karnataka",
  "district": "Bengaluru Urban",
  "relevant_court": "Bengaluru City Civil Court",
  "incident_date": "2026-10-15",
  "preferred_language": "en",
  "urgency": "TIME_BOUND_30D",
  "supporting_info": "Possession letter signed by landlord on handover.",
  "adverse_parties": "Brigade Commercial Holdings Pvt Ltd"
}
```
* **Response (201 Created):**
```json
{
  "id": "case-uuid",
  "case_reference": "NYA-2026-CS-4819",
  "client_id": "usr-uuid",
  "title": "Unlawful Retention of Commercial Lease Deposit",
  "stage": "TRIAGED",
  "conflict_status": "CLEARED",
  "triage_result": {
    "identified_category": "Property & Tenancy Disputes",
    "summary_of_facts": "Landlord refused to return security deposit post premises handover.",
    "missing_information": ["Copy of registered commercial lease deed", "Written deposit refund demand notice"],
    "possible_jurisdiction": "Bengaluru City Civil Court / Small Causes Court",
    "urgency_level": "MODERATE",
    "complexity": "MEDIUM",
    "suggested_next_step": "Issue 15-day statutory demand notice through counsel.",
    "advocate_assistance_appropriate": true,
    "show_free_legal_aid": false,
    "assessed_at": "2026-11-20T10:15:00Z"
  },
  "created_at": "2026-11-20T10:15:00Z",
  "updated_at": "2026-11-20T10:15:00Z"
}
```

---

### `GET /api/v1/cases`
Retrieves paginated cases belonging to the authenticated citizen. Enforces ownership isolation.
* **Authentication:** Bearer JWT (`CITIZEN` or `ADMIN`)
* **Query Parameters:** `page` (default 1), `limit` (default 20)
* **Response (200 OK):**
```json
{
  "total": 3,
  "page": 1,
  "limit": 20,
  "items": [ /* array of CaseResponse objects */ ]
}
```

---

### `GET /api/v1/cases/{case_id}`
Retrieves full case dossier details. Callers must be the case owner, assigned counsel, or platform admin.
* **Authentication:** Bearer JWT
* **Response (200 OK):** Detailed `CaseResponse` including attached triage data.
* **Error Responses:** `404 Not Found` or `403 Forbidden`.

---

## 4. Deterministic Triage Module (`/triage`)

### `POST /api/v1/triage/assess`
Evaluates a legal problem narrative without requiring an active case dossier. Routes to one of 4 deterministic paths: `SELF_HELP`, `FREE_LEGAL_AID`, `ADVOCATE_CONSULTATION`, or `URGENT_ASSISTANCE`.
* **Authentication:** Public / Optional JWT
* **Request Body:**
```json
{
  "narrative": "Employer withheld my final salary for 3 months without termination letter.",
  "annual_income_inr": 240000,
  "incident_date": "2026-09-01",
  "state": "Maharashtra",
  "district": "Mumbai"
}
```
* **Response (200 OK):**
```json
{
  "identified_category": "Labour & Employment Disputes",
  "urgency_level": "ROUTINE",
  "complexity": "LOW",
  "advocate_assistance_appropriate": false,
  "show_free_legal_aid": true,
  "recommended_route": "FREE_LEGAL_AID",
  "suggested_next_step": "Eligible for free legal assistance through DLSA under Legal Services Authorities Act, 1987 (annual income <= ₹3,00,000).",
  "possible_jurisdiction": "Labour Commissioner Office / Labour Court Mumbai",
  "missing_information": ["Offer letter and employment contract", "Bank statement showing salary default"]
}
```

---

## 5. Advocate Matching & Discovery (`/matching` & `/advocates`)

### `GET /api/v1/matching/advocates`
BCI Rule 36 compliant advocate discovery. Evaluates transparent multi-factor scoring: Practice Fit (35%), Court Proximity (25%), Language (20%), Experience (10%), and Availability (10%). Zero paid boosting.
* **Authentication:** Public
* **Query Parameters:** `practice_area`, `city`, `district`, `language`, `limit` (default 10)
* **Response (200 OK):**
```json
{
  "total": 5,
  "advocates": [
    {
      "id": "adv_1024-uuid",
      "user_id": "usr_9988-uuid",
      "full_name": "Adv. Rajeshwari Sen",
      "bar_council_id": "D/1234/2006",
      "bar_council_name": "Bar Council of Delhi",
      "in_practice_years": 18,
      "primary_practice": "Trials & Disputes",
      "secondary_practices": ["Commercial Arbitration", "White Collar Criminal Defense"],
      "courts_of_practice": ["Delhi High Court", "Supreme Court of India"],
      "languages": ["English", "Hindi"],
      "city": "New Delhi",
      "district": "New Delhi",
      "fixed_consultation_fee_inr": 2500.0,
      "hourly_rate_inr": 5000.0,
      "is_verified": true,
      "match_score": 0.94,
      "match_reasons": ["Exact match on Trials & Disputes", "Directly practices in Delhi High Court"]
    }
  ]
}
```

---

### `POST /api/v1/advocates/verification/apply`
Allows an advocate to submit their Bar Council credentials, certificate uploads, and enrollment date for admin review.
* **Authentication:** Bearer JWT (`ADVOCATE`)
* **Request Body:** Form metadata + PDF document uploads.
* **Response (201 Created):** Verification application dossier with status `SUBMITTED`.

---

## 6. Grounded Legal AI Assistant (`/legal`)

### `POST /api/v1/legal/ask`
*(Also accessible via alias `POST /api/v1/legal-assistant/ask`)*  
Executes Grounded Retrieval-Augmented Generation against verified Indian Bare Acts and judgments.
* **Authentication:** Public / Optional JWT
* **Request Body:**
```json
{
  "query": "A post-dated cheque was returned with memo 'Funds Insufficient'. What is the limitation period for legal notice?",
  "jurisdiction": "Union of India",
  "preferred_language": "en",
  "max_sources": 3
}
```
* **Response (200 OK):**
```json
{
  "answer": "Under **Negotiable Instruments Act, 1881**, **Section 138: Dishonour of cheque for insufficiency, etc., of funds in the account**, the law provides that a formal statutory legal demand notice in writing must be issued to the drawer within thirty (30) days of receiving information from the bank regarding the return of the cheque as unpaid. If the drawer fails to make payment within fifteen (15) days of receipt of notice, cause of action arises to file a criminal complaint within one month under Section 142.",
  "sources_found": true,
  "detected_language": "en",
  "cited_references": [
    {
      "source_title": "Negotiable Instruments Act, 1881",
      "source_type": "BARE_ACT",
      "act_or_judgment_identifier": "Act No. 26 of 1881",
      "section_or_paragraph": "Section 138",
      "clause_heading": "Dishonour of cheque for insufficiency, etc., of funds in the account",
      "official_source_url": "https://www.indiacode.nic.in/handle/123456789/2189",
      "content_checksum": "9b1c7a82f3..."
    }
  ],
  "suggested_next_steps": [
    "Issue statutory legal demand notice in writing within 30 days of the bank return memo.",
    "Allow 15 days for the drawer to make payment post receipt of notice.",
    "File formal complaint under Section 138 before the competent Judicial Magistrate within 1 month."
  ],
  "disclaimer": "This preliminary assessment is generated for informational guidance from verified Indian statutes and does not constitute legal advice under the Advocates Act, 1961. Submitting this query does not establish an advocate-client relationship."
}
```

---

## 7. Evidence & Document Vault (`/documents`)

### `POST /api/v1/documents/cases/{case_id}/upload`
Uploads case evidence or legal notice filings to private storage with SHA-256 integrity validation and case ownership enforcement.
* **Authentication:** Bearer JWT (`CITIZEN`, `ADVOCATE`, `ADMIN`)
* **Request:** Multipart Form Data:
  * `file`: Binary document (`.pdf`, `.png`, `.jpeg`, `.docx` up to 25MB)
  * `document_category`: Form field (`"EVIDENCE"` | `"NOTICE"` | `"PLEADINGS"`)
  * `is_confidential`: Form field (`true` | `false`)
* **Response (201 Created):**
```json
{
  "id": "doc-uuid",
  "case_id": "case-uuid",
  "file_name": "Bank_Return_Memo_Cheque_04819.pdf",
  "file_size_bytes": 142080,
  "mime_type": "application/pdf",
  "document_category": "EVIDENCE",
  "sha256_checksum": "a4f89b...",
  "is_confidential": true,
  "uploaded_at": "2026-11-20T10:30:00Z"
}
```

---

### `GET /api/v1/documents/{document_id}/access-token`
Generates an authorized, short-lived signed download token valid for 15 minutes. Never exposes public static file URLs.
* **Authentication:** Bearer JWT (Owner, Lead Advocate, or Admin)
* **Response (200 OK):**
```json
{
  "document_id": "doc-uuid",
  "download_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "expires_in_seconds": 900,
  "download_url": "/api/v1/documents/doc-uuid/download?token=eyJhbGciOiJIUzI1NiIsIn..."
}
```

---

### `GET /api/v1/documents/{document_id}/download`
Securely streams document binary from private vault using either Bearer token or short-lived download token.
* **Authentication:** Bearer JWT OR `?token=<download_token>` query parameter
* **Response (200 OK):** Binary file stream with `Content-Type` and `Content-Disposition`.

---

## 8. Appointments & Consultation Booking (`/appointments`)

### `POST /api/v1/appointments`
Reserves a consultation slot with conflict check and booking reference generation (`NYA-BK-2026-XXXX`).
* **Authentication:** Bearer JWT (`CITIZEN`)
* **Request Body:**
```json
{
  "advocate_id": "adv-uuid",
  "case_id": "case-uuid",
  "scheduled_start": "2026-11-25T10:00:00Z",
  "scheduled_end": "2026-11-25T10:30:00Z",
  "timezone": "Asia/Kolkata",
  "mode": "VIDEO",
  "fee_inr": 2500.0,
  "client_notes": "Preliminary conference regarding Section 138 demand notice."
}
```
* **Response (201 Created):**
```json
{
  "id": "appt-uuid",
  "booking_reference": "NYA-BK-2026-1049",
  "advocate_id": "adv-uuid",
  "client_id": "usr-uuid",
  "scheduled_start": "2026-11-25T10:00:00Z",
  "scheduled_end": "2026-11-25T10:30:00Z",
  "status": "PENDING_CONFIRMATION",
  "mode": "VIDEO",
  "fee_inr": 2500.0,
  "payment_status": "PENDING"
}
```

---

### `PATCH /api/v1/appointments/{appointment_id}/accept`
Empanelled advocate accepts a requested consultation appointment.
* **Authentication:** Bearer JWT (`ADVOCATE`)
* **Response (200 OK):** Returns appointment with `status: "CONFIRMED"`.

---

## 9. Statutory Deadlines & Limitation Tracking (`/deadlines`)

### `POST /api/v1/deadlines`
Creates a court deadline or statutory limitation period linked to a case docket.
* **Authentication:** Bearer JWT (`CITIZEN`, `ADVOCATE`, `ADMIN`)
* **Request Body:**
```json
{
  "case_id": "case-uuid",
  "title": "Section 138 Statutory Demand Notice Expiry",
  "deadline_date": "2026-12-05",
  "deadline_type": "STATUTORY_LIMITATION",
  "statutory_basis": "Negotiable Instruments Act, 1881 — Section 138 proviso (b)",
  "remind_days_before": [7, 3, 1]
}
```
* **Response (201 Created):** Returns `DeadlineResponse`.

---

### `PATCH /api/v1/deadlines/{deadline_id}/confirm`
Advocate review confirmation of a statutory deadline (`is_advocate_confirmed: true`).
* **Authentication:** Bearer JWT (`ADVOCATE`)
* **Response (200 OK):** Updated deadline with confirmation timestamp and advocate ID.

---

## 10. Platform Governance & Admin Module (`/admin`)

### `GET /api/v1/admin/stats`
Platform oversight metrics: user counts, active dockets, appointment counts, and audit volume.
* **Authentication:** Bearer JWT (`ADMIN` only)
* **Response (200 OK):**
```json
{
  "total_users": 142,
  "citizens_count": 118,
  "advocates_count": 23,
  "active_cases": 45,
  "total_appointments": 82,
  "statutory_chunks_indexed": 5
}
```

---

### `POST /api/v1/admin/advocates/{advocate_id}/verify`
Admin verifies an advocate's State Bar Council credentials and sets `is_verified: true`.
* **Authentication:** Bearer JWT (`ADMIN` only)
* **Request Body:**
```json
{
  "decision_reason": "Verified enrollment certificate against Bar Council of Delhi gazette rolls.",
  "official_roll_registration": "D/1234/2006"
}
```
* **Response (200 OK):** `{"success": true, "message": "Advocate credentials verified successfully."}`

---

### `GET /api/v1/admin/audit-logs`
Inspects immutable compliance audit logs for DPDP consent changes, auth attempts, and RAG queries.
* **Authentication:** Bearer JWT (`ADMIN` only)
* **Query Parameters:** `page`, `limit`, `action`
* **Response (200 OK):** Paginated array of audit log entries.
