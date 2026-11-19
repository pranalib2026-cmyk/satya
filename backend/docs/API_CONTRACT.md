# API Contract — NyayaSetu API v1

All version 1 endpoints are routed under prefix `/api/v1`.

## 1. Authentication & Authorization Module

Authentication uses **Argon2id** password hashing and **JWT** (JSON Web Tokens) with short-lived access tokens and rotated, revocable refresh tokens.

### Account Roles
1. `CITIZEN`: Standard litigant or business client seeking legal advisory or court representation.
2. `ADVOCATE`: Verified legal practitioner empanelled on NyayaSetu with Bar Council credentials.
3. `ADMIN`: Platform administrator managing conflict clearance, audits, and compliance. **Never self-assignable.**

---

### `POST /api/v1/auth/register`
Onboards a new citizen or advocate user. The role is strictly enforced by the backend (`CITIZEN` or `ADVOCATE`). Any request attempting to assign `ADMIN` is rejected.

* **Authentication:** Public
* **Request Body (Citizen):**
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
* **Request Body (Advocate):**
```json
{
  "account_type": "ADVOCATE",
  "full_name": "Adv. Rajeshwari Sen",
  "email": "r.sen@nyayasetu.in",
  "phone": "+919811223344",
  "password": "LegalPassword2026",
  "bar_council_id": "D/1234/2006",
  "bar_council_name": "Bar Council of Delhi",
  "in_practice_years": 18,
  "primary_practice": "Trials & Disputes",
  "city": "New Delhi",
  "state": "Delhi",
  "pincode": "110001"
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
  "created_at": "2026-11-17T15:45:00Z"
}
```
* **Error Responses:**
  * `409 Conflict`: If email, phone, or bar_council_id already exists.
  * `422 Unprocessable Entity`: If password fails complexity rules (< 8 chars, missing number or letter) or if `account_type == "ADMIN"`.

---

### `POST /api/v1/auth/login`
Authenticates user with email and password via Argon2id verification and returns JWT tokens.

* **Authentication:** Public
* **Request Body:**
```json
{
  "email": "aarav.sharma@example.com",
  "password": "SecurePassword123"
}
```
* **Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "e4b2d5f0-6a12-4d89-b22c-8d1976bcf129",
    "email": "aarav.sharma@example.com",
    "phone": "+919876543210",
    "full_name": "Aarav Sharma",
    "role": "CITIZEN",
    "is_verified": false,
    "is_active": true,
    "preferred_language": "hi",
    "created_at": "2026-11-17T15:45:00Z"
  }
}
```
* **Error Responses:**
  * `401 Unauthorized`: Invalid email or password.
  * `403 Forbidden`: Account deactivated.

---

### `POST /api/v1/auth/refresh`
Submits an active refresh token to invalidate it (rotation) and receive a new access/refresh token pair. Implements OWASP Token Reuse Mitigation (revokes all sessions if a revoked token is used).

* **Authentication:** Public (Refresh Token Bearer)
* **Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
* **Response (200 OK):** Same shape as `POST /login` with freshly rotated tokens.
* **Error Responses:**
  * `401 Unauthorized`: Token expired, malformed, or previously revoked.

---

### `POST /api/v1/auth/logout`
Revokes user's active refresh tokens.

* **Authentication:** Bearer Token (`Authorization: Bearer <access_token>`)
* **Request Body (Optional):**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Successfully logged out. Refresh token revoked."
}
```

---

### `GET /api/v1/auth/me`
Retrieves authenticated user profile. Password hash is never exposed.

* **Authentication:** Bearer Token (`Authorization: Bearer <access_token>`)
* **Response (200 OK):**
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
  "created_at": "2026-11-17T15:45:00Z"
}
```
* **Error Responses:**
  * `401 Unauthorized`: Missing, invalid, or expired access token.

---

## 2. Advocate Registration & Verification Module

A registered advocate must **not** automatically become a verified advocate. Every profile initially begins in `PENDING` status and can only enter matching results once explicitly `VERIFIED` by an administrator.

### Workflow Status Lifecycle
```
PENDING ──▶ UNDER_REVIEW ──▶ VERIFIED (eligible for matching)
   │             │
   ▼             ▼
REJECTED      REJECTED
```

### Verification Endpoints

#### `POST /api/v1/advocates/apply`
Advocate submits their complete professional profile.
* **Authentication:** Optional Bearer Token (if logged in; otherwise accepts `password` to register fresh user account)
* **Request Body:**
```json
{
  "full_name": "Adv. Vikram Malhotra",
  "email": "v.malhotra@nyayasetu.in",
  "phone": "+919810123456",
  "password": "SecurePassword2026",
  "bar_council_id": "D/1089/2014",
  "bar_council_name": "Bar Council of Delhi",
  "practice_areas": ["Trials & Disputes", "Criminal Defense"],
  "courts_of_practice": ["Supreme Court of India", "Delhi High Court"],
  "languages": ["English", "Hindi"],
  "years_of_experience": 12,
  "city": "New Delhi",
  "district": "Central Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "latitude": 28.6139,
  "longitude": 77.2090
}
```
* **Response (201 Created):**
```json
{
  "id": "e4b2d5f0-6a12-4d89-b22c-8d1976bcf129",
  "user_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "full_name": "Adv. Vikram Malhotra",
  "email": "v.malhotra@nyayasetu.in",
  "phone": "+919810123456",
  "bar_council_id": "D/1089/2014",
  "bar_council_name": "Bar Council of Delhi",
  "practice_areas": ["Trials & Disputes", "Criminal Defense"],
  "primary_practice": "Trials & Disputes",
  "secondary_practices": ["Criminal Defense"],
  "courts_of_practice": ["Supreme Court of India", "Delhi High Court"],
  "languages": ["English", "Hindi"],
  "years_of_experience": 12,
  "city": "New Delhi",
  "district": "Central Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "platform_verification_status": "PENDING",
  "is_verified": false,
  "documents": [],
  "created_at": "2026-11-17T19:50:00Z",
  "updated_at": "2026-11-17T19:50:00Z"
}
```

---

#### `GET /api/v1/advocates/me`
Retrieves the logged-in advocate's complete profile, verification status, and uploaded credential documents.
* **Authentication:** Bearer Token (Role: `ADVOCATE`)
* **Response (200 OK):** `AdvocateProfileDetailResponse`

---

#### `GET /api/v1/admin/advocates/pending`
Admin lists advocate profiles awaiting verification review.
* **Authentication:** Bearer Token (Role: `ADMIN`)
* **Query Parameters:** `status` (default `PENDING`), `page` (default 1), `page_size` (default 20)
* **Response (200 OK):** `AdminPendingAdvocatesResponse` containing items with document counts.

---

#### `GET /api/v1/admin/advocates/{id}`
Admin retrieves full details of an advocate by ID, including uploaded documents and verification history.
* **Authentication:** Bearer Token (Role: `ADMIN`)
* **Response (200 OK):** `AdvocateProfileDetailResponse`

---

#### `PATCH /api/v1/admin/advocates/{id}/verification`
Admin reviews and updates the advocate's verification status.
* **Authentication:** Bearer Token (Role: `ADMIN`)
* **Request Body:**
```json
{
  "status": "VERIFIED",
  "decision_reason": "Verified against 2014 Bar Council of Delhi Enrollment Roll entry 1089.",
  "evidence_level": "OFFICIAL_ROLL_MATCHED",
  "source_name": "Bar Council of Delhi Official Roll (2014)"
}
```
* **Response (200 OK):** Updated `AdvocateProfileDetailResponse` with `platform_verification_status: "VERIFIED"` and `is_verified: true`.
* **Security & Invariants:**
  - Admin self-approval is forbidden (`403 Forbidden`).
  - Automatically records an immutable entry in `AuditLog`.
  - Only `VERIFIED` advocates enter matching engine results.

---

### Evidence Levels
1. `DOCUMENTS_REVIEWED`: Uploaded certificates reviewed and verified for authenticity.
2. `OFFICIAL_ROLL_MATCHED`: Cross-referenced and confirmed against official State Bar Council Roll.
3. `COUNCIL_CONFIRMED`: Directly confirmed by State Bar Council communications or official database.

---

### `POST /api/v1/advocates/me/verification`
Advocate submits their professional credential verification application.
* **Authentication:** Bearer Token (Role: `ADVOCATE`)
* **Request Body:**
```json
{
  "enrollment_number": "D/1234/2006",
  "enrollment_name": "Adv. Rajeshwari Sen",
  "state_bar_council": "Bar Council of Delhi",
  "enrollment_date": "2006-08-15",
  "aibe_status": "PASSED",
  "cop_status": "ACTIVE",
  "contact_phone": "+919811223344",
  "contact_email": "r.sen@nyayasetu.in"
}
```
* **Response (201 Created):**
```json
{
  "id": "7f8b3c10-9012-4e56-8a7b-3c4d5e6f7a8b",
  "enrollment_number": "D/1234/2006",
  "enrollment_name": "Adv. Rajeshwari Sen",
  "state_bar_council": "Bar Council of Delhi",
  "enrollment_date": "2006-08-15",
  "aibe_status": "PASSED",
  "cop_status": "ACTIVE",
  "platform_verification_status": "SUBMITTED",
  "evidence_level": null,
  "verification_method": null,
  "decision_reason": null,
  "info_request_message": null,
  "submitted_at": "2026-11-17T16:00:00Z",
  "decided_at": null,
  "created_at": "2026-11-17T16:00:00Z",
  "documents": []
}
```
* **Error Responses:**
  * `400 Bad Request`: Enrollment number format does not match State Bar Council pattern.
  * `403 Forbidden`: User is not an advocate.
  * `409 Conflict`: Verification application or normalized enrollment number already exists.

---

### `GET /api/v1/advocates/me/verification`
Retrieves the current advocate's application status and document metadata. (Internal admin notes are never included).
* **Authentication:** Bearer Token (Role: `ADVOCATE`)
* **Response (200 OK):** `VerificationApplicationResponse` or `null`.

---

### `POST /api/v1/advocates/me/verification/documents`
Uploads a credential document (multipart form data). Documents are stored in private storage and never exposed publicly.
* **Authentication:** Bearer Token (Role: `ADVOCATE`)
* **Form Parameters:**
  * `verification_type`: `ENROLLMENT_CERTIFICATE` | `BAR_ID_CARD` | `AIBE_CERTIFICATE` | `COP_CERTIFICATE`
  * `file`: Binary file (PDF, JPEG, PNG, WebP; max 10 MB)
* **Response (201 Created):**
```json
{
  "id": "9a0b1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d",
  "verification_type": "ENROLLMENT_CERTIFICATE",
  "filename": "bar_enrolment_cert.pdf",
  "content_type": "application/pdf",
  "size_bytes": 204850,
  "status": "PENDING",
  "created_at": "2026-11-17T16:05:00Z"
}
```

---

### `GET /api/v1/advocates/me/verification/documents/{document_id}/download`
Securely downloads an uploaded credential document. Advocates can only access their own documents.
* **Authentication:** Bearer Token (Role: `ADVOCATE`)
* **Response (200 OK):** Binary file stream with `Content-Disposition: inline`.

---

### `GET /api/v1/admin/advocate-verifications`
Lists verification applications for admin review.
* **Authentication:** Bearer Token (Role: `ADMIN`)
* **Query Parameters:** `status` (optional filter), `page` (default 1), `page_size` (default 20)
* **Response (200 OK):** `AdminVerificationListResponse` with items, total, page, page_size.

---

### `GET /api/v1/admin/advocate-verifications/{id}`
Returns full verification details including private reviewer notes and uploaded document records.
* **Authentication:** Bearer Token (Role: `ADMIN`)
* **Response (200 OK):** `AdminVerificationDetailResponse`.

---

### `POST /api/v1/admin/advocate-verifications/{id}/decision`
Admin records approval or rejection of an advocate application.
* **Authentication:** Bearer Token (Role: `ADMIN`)
* **Request Body:**
```json
{
  "decision": "VERIFIED",
  "evidence_level": "OFFICIAL_ROLL_MATCHED",
  "verification_method": "MANUAL_ADMIN",
  "source_name": "Bar Council of Delhi Official Roll (2006)",
  "source_url": "https://delhibarcouncil.com/rolls/2006/D-1234",
  "decision_reason": "Verified against 2006 Delhi State Roll entry. Valid COP.",
  "internal_notes": "Identity and active practice confirmed."
}
```
* **Response (200 OK):** Updated `AdminVerificationDetailResponse`.
* **Security:** Prevents admin self-approval (admin cannot verify their own advocate profile).

---

### `POST /api/v1/admin/advocate-verifications/{id}/request-info`
Admin requests additional information or documentation from the advocate.
* **Authentication:** Bearer Token (Role: `ADMIN`)
* **Request Body:**
```json
{
  "message": "Please upload your renewed Certificate of Practice (COP).",
  "internal_notes": "Advocate enrolled in 2017; 5-year COP renewal required."
}
```
* **Response (200 OK):** Updated `AdminVerificationDetailResponse` with status `NEEDS_MORE_INFORMATION`.

---

### `GET /api/v1/admin/advocate-verifications/documents/{document_id}/download`
Admin securely downloads and views an advocate's uploaded document.
* **Authentication:** Bearer Token (Role: `ADMIN`)
* **Response (200 OK):** Binary file stream.

---

## 3. Matching Engine Module

### `GET /api/v1/matching/advocates`
Search for platform-verified advocates eligible for matching.
* **Authentication:** Public
* **Query Parameters:** `practice`, `city`, `page`, `page_size`
* **Eligibility Filter:** Only returns advocates with `platform_verification_status == "VERIFIED"` and active account (`is_active == True`).
* **Response (200 OK):**
```json
{
  "items": [
    {
      "id": "e4b2d5f0-6a12-4d89-b22c-8d1976bcf129",
      "full_name": "Adv. Rajeshwari Sen",
      "bar_council_name": "Bar Council of Delhi",
      "primary_practice": "Trials & Disputes",
      "in_practice_years": 18,
      "city": "New Delhi",
      "state": "Delhi",
      "is_verified": true,
      "fixed_consultation_fee_inr": 2500.0
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

---

## 4. System Diagnostic Endpoint

### `GET /api/v1/health`
Checks service health, semantic version, active environment, and PostgreSQL connection.

* **Authentication:** Public
* **Response (200 OK):**
```json
{
  "status": "healthy",
  "app_name": "NyayaSetu Backend API",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-11-17T15:45:00Z",
  "database": {
    "status": "connected",
    "latency_ms": 1.25,
    "dialect": "psycopg3",
    "extensions": {
      "postgis": "3.4.2",
      "vector": "0.7.0",
      "uuid-ossp": "1.1"
    },
    "error": null
  }
}
```

---

## 3. Case Intake & Triage Module

Enables citizens to describe legal grievances, receive automated deterministic triage assessments, track dossiers, and enforce case privacy.

### `POST /api/v1/cases`
Submits a new legal problem for intake and auto-generates reference code `NYA-2026-CS-XXXX` with an initial triage evaluation.

* **Authentication:** Authenticated (`CITIZEN` or `ADMIN`)
* **Request Body:**
```json
{
  "title": "Unlawful Deduction of Security Deposit by Landlord",
  "problem_description": "I vacated my rented apartment in Whitefield after serving full two months notice period. The landlord Mr. Sharma is refusing to refund my security deposit of Rs 1,20,000 citing fictitious damages.",
  "legal_issue_category": "Property & Real Estate",
  "state": "Karnataka",
  "district": "Bengaluru Urban",
  "relevant_court": "Court of Small Causes, Bengaluru",
  "incident_date": "2026-09-15",
  "preferred_language": "en",
  "urgency": "standard-30d",
  "supporting_info": "Registered 11-month agreement, bank transfer statement of deposit.",
  "adverse_parties": "Rakesh Sharma (Landlord)"
}
```
* **Response (201 Created):**
```json
{
  "id": "7b049d1e-8fe5-4b0d-9b7e-97645bb7a982",
  "case_reference": "NYA-2026-CS-84A2",
  "client_id": "e4b2d5f0-6a12-4d89-b22c-8d1976bcf129",
  "title": "Unlawful Deduction of Security Deposit by Landlord",
  "problem_description": "I vacated my rented apartment...",
  "legal_issue_category": "Property & Real Estate",
  "state": "Karnataka",
  "district": "Bengaluru Urban",
  "relevant_court": "Court of Small Causes, Bengaluru",
  "incident_date": "2026-09-15",
  "preferred_language": "en",
  "urgency": "standard-30d",
  "supporting_info": "Registered 11-month agreement...",
  "adverse_parties": "Rakesh Sharma (Landlord)",
  "stage": "INTAKE",
  "conflict_status": "CLEARANCE_PENDING",
  "triage_result": {
    "identified_category": "Property & Real Estate",
    "summary_of_facts": "Matter titled '...' categorized under Property & Real Estate...",
    "missing_information": [],
    "possible_jurisdiction": "Court of Small Causes, Bengaluru",
    "urgency_level": "STANDARD_30D",
    "complexity": "MEDIUM",
    "suggested_next_step": "ADVOCATE_CONSULTATION",
    "advocate_assistance_appropriate": true,
    "show_free_legal_aid": false,
    "assessed_at": "2026-11-17T20:10:00Z"
  },
  "created_at": "2026-11-17T20:10:00Z",
  "updated_at": "2026-11-17T20:10:00Z"
}
```

---

### `GET /api/v1/cases`
Lists all cases owned by the authenticated citizen. Strict ownership isolation ensures callers never view other clients' matters.

* **Authentication:** Authenticated (`CITIZEN`, `ADVOCATE`, `ADMIN`)
* **Query Parameters:** `page` (default 1), `limit` (default 20, max 100)
* **Response (200 OK):**
```json
{
  "total": 1,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": "7b049d1e-8fe5-4b0d-9b7e-97645bb7a982",
      "case_reference": "NYA-2026-CS-84A2",
      "client_id": "e4b2d5f0-6a12-4d89-b22c-8d1976bcf129",
      "title": "Unlawful Deduction of Security Deposit by Landlord",
      "stage": "INTAKE",
      "urgency": "standard-30d",
      "created_at": "2026-11-17T20:10:00Z"
    }
  ]
}
```

---

### `GET /api/v1/cases/{case_id}`
Retrieves complete case details. Returns `403 Forbidden` if requested by an unassigned user.

* **Authentication:** Authenticated (Owner `CITIZEN`, assigned `ADVOCATE`, or `ADMIN`)
* **Response (200 OK):** Full `CaseResponse` model

---

### `PATCH /api/v1/cases/{case_id}`
Partially updates case details. Creates an immutable `AuditLog` entry.

* **Authentication:** Authenticated (Owner `CITIZEN` or `ADMIN`)
* **Request Body:** Partial `CaseUpdateRequest`
* **Response (200 OK):** Updated `CaseResponse`

---

### `POST /api/v1/cases/{case_id}/triage`
Executes or re-evaluates the deterministic legal triage assessment on the existing case dossier.

* **Authentication:** Authenticated (Owner `CITIZEN` or `ADMIN`)
* **Response (200 OK):**
```json
{
  "identified_category": "Cheque Bounce (Sec 138 NI Act)",
  "summary_of_facts": "Matter titled '...' categorized under Cheque Bounce...",
  "missing_information": [
    "Bank return memo with exact dishonour reason (e.g., Funds Insufficient).",
    "Proof and dispatch date of statutory 15-day legal demand notice sent to drawer."
  ],
  "possible_jurisdiction": "Court of Judicial Magistrate First Class (JMFC) / Metropolitan Magistrate, Mumbai, Maharashtra",
  "urgency_level": "STANDARD_30D",
  "complexity": "MEDIUM",
  "suggested_next_step": "ADVOCATE_CONSULTATION",
  "advocate_assistance_appropriate": true,
  "show_free_legal_aid": false,
  "assessed_at": "2026-11-17T20:10:00Z"
}
```

---

### `POST /api/v1/triage/assess`
Instant, pre-registration preliminary legal assessment without creating a database case record.

* **Authentication:** Public / Authenticated
* **Request Body:** `CaseCreateRequest`
* **Response (200 OK):** `TriageOutputResponse`

---

## 4. Advocate Matching Engine & Private Consultation Requests

Private, case-driven advocate matching adhering to Bar Council of India (BCI) Rule 36:
- Zero paid promotion or sponsored placement.
- Zero subjective popularity ratings or fabricated reviews.
- Factual, objective match explanations based strictly on verified credentials and territorial nexus.

### Matching Criteria & Configurable Factor Weights
1. **Hard Filters:**
   - Advocate status must be strictly `VERIFIED` (`platform_verification_status == "VERIFIED"`).
   - Practice area must be relevant to the case category.
   - Court jurisdiction must be compatible with case forum or territorial jurisdiction.
   - Optional budget constraint: `max_budget_inr` filters out candidates exceeding the client's consultation budget (without boosting rank).
   - Optional distance constraint: `max_distance_km` filters candidates outside the geodesic radius.
2. **Scoring Factor Weights (Configurable in Settings):**
   - Practice area relevance: **35%** (`MATCHING_WEIGHT_PRACTICE = 0.35`)
   - Jurisdiction and court compatibility: **25%** (`MATCHING_WEIGHT_JURISDICTION = 0.25`)
   - Language compatibility: **20%** (`MATCHING_WEIGHT_LANGUAGE = 0.20`)
   - Geographic proximity: **10%** (`MATCHING_WEIGHT_PROXIMITY = 0.10`)
   - Availability: **10%** (`MATCHING_WEIGHT_AVAILABILITY = 0.10`)

---

### `GET /api/v1/matching/cases/{case_id}/advocates`
Evaluates verified advocates against the citizen's case requirements and returns scored, ranked candidates with factual match explanations.

* **Authentication:** Authenticated (Case owner `CITIZEN` or `ADMIN`)
* **Query Parameters:**
  * `max_distance_km` (Optional[float]): Distance radius threshold in kilometers.
  * `max_budget_inr` (Optional[float]): Maximum acceptable consultation fee filter.
  * `preferred_language` (Optional[str]): Preferred consultation language.
  * `limit` (int, default 10, max 50): Max candidates to return.
* **Response (200 OK):**
```json
{
  "case_id": "7b049d1e-8fe5-4b0d-9b7e-97645bb7a982",
  "case_reference": "NYA-2026-CS-84A2",
  "case_title": "Unlawful Deduction of Security Deposit by Landlord",
  "category": "Property & Real Estate",
  "state": "Karnataka",
  "district": "Bengaluru Urban",
  "total_candidates_evaluated": 12,
  "total_matches_returned": 2,
  "matches": [
    {
      "advocate_id": "9a12c4d0-5e34-4a67-b890-123456789abc",
      "user_id": "1b23c4d5-6e78-4a90-b123-456789abcdef",
      "full_name": "Adv. Suresh Gowda",
      "bar_council_id": "KAR/1089/2012",
      "bar_council_name": "Bar Council of Karnataka",
      "verified_status": "VERIFIED",
      "years_of_experience": 14,
      "primary_practice": "Property & Real Estate",
      "relevant_practice_areas": ["Property & Real Estate", "RERA"],
      "court_compatibility": ["Karnataka High Court", "City Civil Court Bengaluru"],
      "language_compatibility": ["English", "Kannada"],
      "city": "Bengaluru",
      "district": "Bengaluru Urban",
      "state": "Karnataka",
      "approximate_distance_km": 4.2,
      "match_score_percentage": 94.5,
      "match_factors": {
        "practice_relevance": 1.0,
        "jurisdiction_compatibility": 0.9,
        "language_compatibility": 1.0,
        "geographic_proximity": 1.0,
        "availability": 1.0
      },
      "match_explanation": "Verified advocate enrolled with Bar Council of Karnataka (KAR/1089/2012) with 14 years of professional standing. Practices in Property & Real Estate, matching your matter category. Regularly appears before City Civil Court Bengaluru within Bengaluru, Karnataka. Approximate distance to your location: ~4.2 km. Supports consultation in English, Kannada.",
      "consultation_request_availability": true,
      "fixed_consultation_fee_inr": 1500.0,
      "hourly_rate_inr": 3000.0
    }
  ]
}
```

---

### `POST /api/v1/matching/consultation-requests`
Initiates a private, 1-on-1 consultation request to a matched, verified advocate.

* **Authentication:** Authenticated (`CITIZEN`, `ADMIN`)
* **Request Body:**
```json
{
  "case_id": "7b049d1e-8fe5-4b0d-9b7e-97645bb7a982",
  "targeted_advocate_id": "9a12c4d0-5e34-4a67-b890-123456789abc",
  "budget_inr": 1500.0,
  "urgency": "urgent-48h",
  "notes": "Available for virtual video consultation post 5 PM."
}
```
* **Response (201 Created):**
```json
{
  "id": "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
  "reference_code": "NYA-2026-CR-8A4F",
  "client_id": "e4b2d5f0-6a12-4d89-b22c-8d1976bcf129",
  "targeted_advocate_id": "9a12c4d0-5e34-4a67-b890-123456789abc",
  "targeted_advocate_name": "Adv. Suresh Gowda",
  "preferred_practice": "Property & Real Estate",
  "urgency": "urgent-48h",
  "legal_problem_summary": "I vacated my rented apartment in Whitefield...",
  "adverse_party_names": "Rakesh Sharma (Landlord)",
  "status": "SUBMITTED",
  "source_screen": "ADVOCATE_MATCHING_MODAL",
  "budget_inr": 1500.0,
  "triage_notes_json": {
    "case_id": "7b049d1e-8fe5-4b0d-9b7e-97645bb7a982",
    "case_reference": "NYA-2026-CS-84A2",
    "budget_inr": 1500.0,
    "client_notes": "Available for virtual video consultation post 5 PM."
  },
  "created_at": "2026-11-17T20:20:00Z",
  "updated_at": "2026-11-17T20:20:00Z"
}
```

---

### `GET /api/v1/matching/consultation-requests`
Lists consultation requests with role-based visibility.

* **Authentication:** Authenticated (`CITIZEN`, `ADVOCATE`, `ADMIN`)
* **Query Parameters:** `page` (default 1), `limit` (default 20)
* **Response (200 OK):** `ConsultationRequestListResponse`

---

## 5. Legal AI Assistant (RAG) & Curated Knowledge Management

Provides hallucination-free legal question answering grounded strictly in verified Indian Bare Acts and published judicial precedents.

### Safety Rules Enforced
- Never invents legal sections, statutes, or court judgments.
- Post-generation citation validation prunes any citation not grounded in the retrieved corpus.
- If retrieved sources are insufficient, explicitly returns that no supporting verified Indian legal sources were found without speculating.
- Never gives guaranteed legal advice; provides mandatory non-advice statutory disclaimer and recommends empanelled advocate assistance.
- Private user case documents (`documents`, `legal_cases`) are kept completely isolated from the public legal knowledge base (`legal_sources`, `legal_chunks`).

---

### `POST /api/v1/legal/ask`
Submits a legal inquiry and returns a structured, citation-grounded answer with actionable next steps.

* **Authentication:** Public or Authenticated
* **Request Body:**
```json
{
  "query": "My business client gave me a cheque of Rs 5 Lakhs which bounced due to insufficient funds. What is the procedure under Section 138?",
  "preferred_language": "en",
  "jurisdiction": "Union of India",
  "max_sources": 3
}
```
* **Response (200 OK):**
```json
{
  "query": "My business client gave me a cheque of Rs 5 Lakhs which bounced due to insufficient funds. What is the procedure under Section 138?",
  "detected_language": "en",
  "answer": "Under **The Negotiable Instruments Act, 1881**, **Section 138: Dishonour of cheque for insufficiency, etc., of funds in the account**, the law provides that: Where any cheque drawn by a person on an account maintained by him with a banker for payment of any amount of money to another person from out of that account for the discharge, in whole or in part, of any debt or other liability, is returned by the bank unpaid...",
  "sources_found": true,
  "citations": [
    {
      "source_title": "The Negotiable Instruments Act, 1881",
      "source_type": "BARE_ACT",
      "act_or_judgment_identifier": "Act No. 26 of 1881",
      "section_or_paragraph": "Section 138",
      "clause_heading": "Dishonour of cheque for insufficiency, etc., of funds in the account",
      "official_source_url": "https://www.indiacode.nic.in/handle/123456789/2189",
      "content_checksum": "9cf1e134685ba0bd2e67a1da629b3a0df47b678c1825fa25d57b328a6bb1f9a1",
      "is_verified_in_corpus": true
    }
  ],
  "unverified_citations_detected": [],
  "suggested_next_steps": [
    "Issue statutory legal demand notice in writing to the drawer within 30 days of receiving the cheque return memo.",
    "Allow 15 days statutory period for the drawer to make payment post receipt of notice.",
    "File formal complaint under Section 138 before the competent Judicial Magistrate within 1 month of cause of action."
  ],
  "disclaimer": "NyayaSetu AI Legal Assistant provides informational guidance derived strictly from official Indian Bare Acts and published judicial precedents. This information does not constitute formal legal advice or create an advocate-client relationship. Litigants should consult an empanelled, verified advocate for matter-specific representation.",
  "retrieved_chunks_count": 2,
  "assessed_at": "2026-11-17T20:25:00Z"
}
```

---

### `POST /api/v1/legal/admin/sources`
Registers an official Indian statutory Bare Act, published judgment, or legal aid scheme.

* **Authentication:** Admin Only (`require_roles("ADMIN")`)
* **Request Body:**
```json
{
  "title": "The Arbitration and Conciliation Act, 1996",
  "source_type": "BARE_ACT",
  "short_code": "ACA_1996",
  "citation": "Act No. 26 of 1996",
  "jurisdiction": "Union of India",
  "document_version": "2026.1",
  "official_source_url": "https://www.indiacode.nic.in/handle/123456789/1978"
}
```
* **Response (201 Created):** Full `LegalSourceResponse`

---

### `POST /api/v1/legal/admin/sources/{source_id}/chunks`
Ingests a section chunk, computes its SHA-256 checksum, generates vector embeddings, and stores it in the vector knowledge base.

* **Authentication:** Admin Only (`require_roles("ADMIN")`)
* **Request Body:**
```json
{
  "section_number": "Section 9",
  "clause_heading": "Interim measures, etc., by Court",
  "chunk_text": "A party may, before or during arbitral proceedings or at any time after the making of the arbitral award, apply to a court for interim measures of protection."
}
```
* **Response (201 Created):**
```json
{
  "id": "e2f1a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
  "source_id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
  "section_number": "Section 9",
  "clause_heading": "Interim measures, etc., by Court",
  "content_checksum": "a1b2c3d4e5f6...",
  "token_count": 32,
  "status": "embedded_and_stored"
}
```

---

### `POST /api/v1/legal/admin/seed`
Manually triggers population of the curated initial Bare Acts dataset (NI Act, CPA 2019, NALSA 1987, BNSS 2023, RERA 2016).

* **Authentication:** Admin Only (`require_roles("ADMIN")`)
* **Response (200 OK):**
```json
{
  "status": "success",
  "chunks_seeded": 11
}
```

---

### `GET /api/v1/legal/admin/sources`
Lists all curated legal sources with current chunk counts.

* **Authentication:** Admin Only (`require_roles("ADMIN")`)
* **Response (200 OK):** `List[LegalSourceResponse]`

---

## 6. Document Vault & Evidence Management Module

Secure document management providing tamper-proof storage in a private vault (`backend/storage/vault/{case_id}/`) outside the public web tree. Enforces case ownership, MIME/extension whitelisting, 25MB maximum size limits, SHA-256 checksums, and signed, 15-minute temporary download access tokens.

### `POST /api/v1/documents/cases/{case_id}/upload`
Uploads a case evidence file, petition, affidavit, or court order.

* **Authentication:** Bearer token (Case owner, lead advocate, or Admin)
* **Form Data:**
  * `file`: Multipart file upload (Max 25MB; allowed: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.doc`, `.docx`)
  * `document_category`: `EVIDENCE` | `PETITION` | `AFFIDAVIT` | `CONTRACT` | `COURT_ORDER`
  * `is_confidential`: `true` | `false`
* **Response (201 Created):**
```json
{
  "id": "c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
  "case_id": "a9b8c7d6-e5f4-3a2b-1c0d-e9f8a7b6c5d4",
  "uploader_id": "e4b2d5f0-6a12-4d89-b22c-8d1976bcf129",
  "file_name": "cheque_return_memo.pdf",
  "file_size_bytes": 1048576,
  "mime_type": "application/pdf",
  "checksum_sha256": "3a5b6c7d8e9f...",
  "is_confidential": true,
  "document_category": "EVIDENCE",
  "metadata_json": {},
  "created_at": "2026-11-17T17:00:00Z",
  "updated_at": "2026-11-17T17:00:00Z"
}
```

---

### `GET /api/v1/documents/cases/{case_id}`
Lists all documents associated with a legal case.

* **Authentication:** Bearer token (Case owner, lead advocate, or Admin)
* **Response (200 OK):** `DocumentListResponse`

---

### `GET /api/v1/documents/{document_id}/access-token`
Issues a signed, short-lived JWT download token expiring in 15 minutes (900s).

* **Authentication:** Bearer token (Case owner, lead advocate, or Admin)
* **Response (200 OK):**
```json
{
  "document_id": "c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
  "file_name": "cheque_return_memo.pdf",
  "download_url": "/api/v1/documents/c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f/download?token=eyJhbGci...",
  "expires_in_seconds": 900,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `GET /api/v1/documents/{document_id}/download`
Streams the binary document with `Content-Disposition: attachment`.

* **Authentication:** Query parameter `?token=<download_token>` OR Authorization header `Bearer <jwt>`
* **Response (200 OK):** Binary file stream with verified MIME type.

---

## 7. Appointments & Consultations Module

Booking engine connecting citizens to verified advocates with strict conflict prevention against overlapping appointment slots.

### `POST /api/v1/appointments`
Citizen books a consultation slot with a verified advocate.

* **Authentication:** Bearer token (Citizen or Admin)
* **Request Body:**
```json
{
  "advocate_id": "b3c4d5e6-f7a8-9b0c-1d2e-3f4a5b6c7d8e",
  "case_id": "a9b8c7d6-e5f4-3a2b-1c0d-e9f8a7b6c5d4",
  "scheduled_start": "2026-11-20T10:00:00Z",
  "scheduled_end": "2026-11-20T10:45:00Z",
  "timezone": "Asia/Kolkata",
  "mode": "VIDEO",
  "client_notes": "Preliminary consultation regarding property title dispute."
}
```
* **Response (201 Created):**
```json
{
  "id": "f1e2d3c4-b5a6-7890-1234-56789abcdef0",
  "booking_reference": "NYA-BK-2026-9A4F",
  "case_id": "a9b8c7d6-e5f4-3a2b-1c0d-e9f8a7b6c5d4",
  "advocate_id": "b3c4d5e6-f7a8-9b0c-1d2e-3f4a5b6c7d8e",
  "client_id": "e4b2d5f0-6a12-4d89-b22c-8d1976bcf129",
  "advocate_name": "Adv. Rajesh Sharma",
  "client_name": "Sunita Rao",
  "scheduled_start": "2026-11-20T10:00:00Z",
  "scheduled_end": "2026-11-20T10:45:00Z",
  "timezone": "Asia/Kolkata",
  "status": "REQUESTED",
  "mode": "VIDEO",
  "meeting_link": null,
  "fee_inr": 2000.0,
  "payment_status": "PENDING",
  "client_notes": "Preliminary consultation regarding property title dispute.",
  "rejection_reason": null,
  "created_at": "2026-11-17T17:10:00Z"
}
```
* **Conflict Behavior (409 Conflict):** If the requested advocate has an existing consultation in `REQUESTED`, `CONFIRMED`, or `SCHEDULED` status that overlaps the requested time window, a `409 CONFLICT` exception is returned immediately.

---

### `PATCH /api/v1/appointments/{appointment_id}/status`
Advocate reviews, accepts, confirms, or rejects a consultation request.

* **Authentication:** Bearer token (Assigned Advocate or Admin)
* **Request Body (Accept):**
```json
{
  "status": "CONFIRMED",
  "meeting_link": "https://meet.nyayasetu.gov.in/chamber-7766"
}
```
* **Request Body (Reject):**
```json
{
  "status": "REJECTED",
  "rejection_reason": "Pre-scheduled High Court bench appearance."
}
```
* **Response (200 OK):** Updated `AppointmentResponse`.

---

### `GET /api/v1/appointments`
Lists appointments scoped to caller's role (Citizens see their bookings, Advocates see chamber consultations, Admins see all).

* **Authentication:** Bearer token
* **Query Parameters:** `status`, `from_date`, `to_date`, `limit`, `offset`
* **Response (200 OK):** `AppointmentListResponse`

---

## 8. Statutory Deadlines & Limitation Management Module

Statutory limitation tracking, court hearing dates, and filing compliance countdowns.
**Compliance Notice:** No automated unverified LLM calculations of statutory limitation periods. Deadlines are created manually or based on verified legal provisions, with independent review and confirmation by verified legal advocates.

### `POST /api/v1/deadlines`
Creates a deadline associated with a case.

* **Authentication:** Bearer token (Case owner, assigned advocate, or Admin)
* **Request Body:**
```json
{
  "case_id": "a9b8c7d6-e5f4-3a2b-1c0d-e9f8a7b6c5d4",
  "title": "Section 138 15-Day Demand Notice Expiry",
  "description": "Period for drawer to make payment following legal notice service.",
  "deadline_type": "STATUTORY_LIMITATION",
  "source_basis": "Section 138(c) Negotiable Instruments Act 1881",
  "statutory_provision": "Section 138(c) NI Act",
  "due_date": "2026-12-02T18:00:00Z",
  "priority": "CRITICAL",
  "reminder_days_before": [7, 3, 1]
}
```
* **Response (201 Created):**
```json
{
  "id": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
  "case_id": "a9b8c7d6-e5f4-3a2b-1c0d-e9f8a7b6c5d4",
  "case_reference": "NYA-2026-CC-8421",
  "title": "Section 138 15-Day Demand Notice Expiry",
  "description": "Period for drawer to make payment following legal notice service.",
  "deadline_type": "STATUTORY_LIMITATION",
  "source_basis": "Section 138(c) Negotiable Instruments Act 1881",
  "statutory_provision": "Section 138(c) NI Act",
  "due_date": "2026-12-02T18:00:00Z",
  "priority": "CRITICAL",
  "is_advocate_confirmed": false,
  "confirmed_by_advocate_id": null,
  "confirmed_at": null,
  "is_completed": false,
  "completed_at": null,
  "reminders_json": {
    "days_before": [7, 3, 1],
    "scheduled_alerts": [
      {"days_before": 7, "scheduled_at": "2026-11-25T18:00:00Z", "status": "PENDING"},
      {"days_before": 3, "scheduled_at": "2026-11-29T18:00:00Z", "status": "PENDING"},
      {"days_before": 1, "scheduled_at": "2026-12-01T18:00:00Z", "status": "PENDING"}
    ],
    "history": []
  },
  "created_at": "2026-11-17T17:20:00Z",
  "updated_at": "2026-11-17T17:20:00Z"
}
```

---

### `PATCH /api/v1/deadlines/{deadline_id}/confirm`
Advocate statutory review and confirmation. Citizens are forbidden from confirming (403 Forbidden).

* **Authentication:** Bearer token (`ADVOCATE` or `ADMIN`)
* **Request Body:**
```json
{
  "verified_statutory_basis": "Section 138(c) NI Act (Summons filing period within 30 days of notice expiry)",
  "confirmation_notes": "Verified against postal speed post tracking delivery receipt."
}
```
* **Response (200 OK):** Updated `DeadlineResponse` with `is_advocate_confirmed: true`, `confirmed_by_advocate_id`, `confirmed_at`.

---

### `PATCH /api/v1/deadlines/{deadline_id}/complete`
Marks a statutory deadline, court hearing, or compliance reminder as completed.

* **Authentication:** Bearer token (Case owner, assigned advocate, or Admin)
* **Response (200 OK):** Updated `DeadlineResponse` with `is_completed: true` and `completed_at`.

---

### `GET /api/v1/deadlines`
Lists case deadlines for the authenticated user with optional `upcoming_only=true` or `is_completed=false` filters.

* **Authentication:** Bearer token
* **Response (200 OK):** `DeadlineListResponse`

---

## 9. Standard Error Response Shape
All application errors follow this unified shape:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable explanation of error.",
    "details": {},
    "path": "/api/v1/endpoint"
  }
}
```
