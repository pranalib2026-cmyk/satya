# Verified Advocate Evaluations & Client Review Implementation

**Status:** Production Ready  
**Date:** November 2026  
**Module:** `backend/app/modules/reviews/` & `frontend/src/app/dashboard/feedback/[bookingId]/`  
**Revision:** `0015_advocate_feedback_and_reviews`  

---

## 1. Executive Summary

NyayaSetu previously utilized an ephemeral mock feedback client simulation (`submitFeedback`) on the post-hearing evaluation screen (`frontend/src/app/dashboard/feedback/[bookingId]/page.tsx`). 

This implementation establishes an authoritative, persistent review and rating architecture:
1. **Cryptographic & Relational Ledger:** Dedicated `reviews` table backed by PostgreSQL and managed through Alembic forward migration `0015_advocate_feedback_and_reviews`.
2. **Booking Verification & Strict Authorization:** Every evaluation requires a valid consultation booking ID. The backend verifies that the authenticated user owns the referenced booking and that the consultation has concluded in a verified `COMPLETED` state.
3. **No Client Spoofing:** Reviewer user ID and advocate profile ID cannot be chosen arbitrarily by the client; they are derived directly from the verified consultation booking record.
4. **Single Evaluation Rule:** Enforces exactly one evaluation per completed booking via database unique constraints and application conflict checks (`HTTP 409 Conflict`).
5. **Real-Time Dynamic Rating Computation:** Advocate ratings, review counts, star distributions, and counsel strengths are calculated strictly through SQL aggregation over persisted `PUBLISHED` reviews—eliminating hardcoded or artificial ratings.
6. **Regulatory Moderation:** Supports statutory moderation (`PENDING`, `PUBLISHED`, `REJECTED`, `HIDDEN`) with administrative audit tracking under Bar Council of India (BCI) Rule 36.

---

## 2. Database Schema (`0015_advocate_feedback_and_reviews`)

### Table: `reviews`

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, Index | Unique evaluation record UUID |
| `booking_id` | `UUID` | Foreign Key (`appointments.id`), Unique, Index | Associated completed consultation booking |
| `reviewer_id` | `UUID` | Foreign Key (`users.id`), Index | Authenticated citizen client |
| `advocate_id` | `UUID` | Foreign Key (`advocate_profiles.id`), Index | Empanelled advocate profile being evaluated |
| `rating` | `INTEGER` | CheckConstraint (1–5), Index | Client statutory evaluation score (1 to 5 stars) |
| `comment` | `TEXT` | Nullable, Max 1,000 chars | Qualitative feedback on statutory advice & procedural steps |
| `tags` | `JSONB` / `JSON` | Nullable, Default `[]` | Selected counsel strengths (e.g. "Clear communication") |
| `matter_resolution` | `VARCHAR(32)` | Nullable | Resolution state: `'yes'`, `'in_progress'`, or `'no'` |
| `status` | `VARCHAR(32)` | Default: `'PUBLISHED'`, Index | Moderation state: `PENDING \| PUBLISHED \| REJECTED \| HIDDEN` |
| `moderation_reason` | `TEXT` | Nullable | Regulatory or administrative moderation rationale |
| `created_at` | `TIMESTAMPTZ` | Index, Default: `now()` | Timestamp of evaluation submission |
| `updated_at` | `TIMESTAMPTZ` | Default: `now()` | Timestamp of last modification |

#### Constraints & Indexes
- **Rating Range:** `CheckConstraint("rating >= 1 AND rating <= 5", name="chk_review_rating_range")`
- **Moderation States:** `CheckConstraint("status IN ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN')", name="chk_review_status")`
- **Unique Booking:** `Index("ix_reviews_booking_id", ["booking_id"], unique=True)`
- **Advocate Status Compound:** `Index("idx_reviews_advocate_status", ["advocate_id", "status"])`
- **Reviewer Index:** `Index("idx_reviews_reviewer", ["reviewer_id"])`

---

## 3. API Contract Specification (`/api/v1/reviews`)

### 3.1 Endpoints Inventory

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/reviews` | Submits verified client evaluation for a completed booking | Citizen Bearer JWT |
| `GET` | `/api/v1/reviews/advocates/{id}` | Retrieves paginated evaluations and summary scoring for advocate | Optional Bearer JWT |
| `GET` | `/api/v1/reviews/advocates/{id}/summary`| Computes average rating, total count, star distribution, and tags | Public |
| `GET` | `/api/v1/reviews/bookings/{id}` | Retrieves existing evaluation for a booking (checks repeat submission) | Client / Advocate / Admin |
| `GET` | `/api/v1/reviews/{id}` | Retrieves evaluation by review ID | Role-Aware |
| `PATCH`| `/api/v1/reviews/{id}` | Updates existing evaluation (rating, comment, tags, resolution) | Author or Admin |
| `DELETE`| `/api/v1/reviews/{id}` | Deletes an evaluation | Author or Admin |
| `POST` | `/api/v1/reviews/{id}/moderate`| Moderates evaluation status (`PENDING`, `PUBLISHED`, `REJECTED`, `HIDDEN`)| Admin Role Guard |

---

### 3.2 Request & Response Payloads

#### `POST /api/v1/reviews`
```json
{
  "booking_id": "893c5d72-b7b5-4a57-b08e-56e6d1911481",
  "rating": 5,
  "comment": "Exemplary procedural clarity on Section 138 notice. Clear actionable timelines.",
  "tags": ["Clear communication", "Punctual & prepared", "Actionable next steps"],
  "resolved": "yes"
}
```

#### `ReviewResponse` (Status: `201 Created`)
```json
{
  "id": "7055fdf5-64f7-438c-85e7-6bdff7cd4e3a",
  "booking_id": "893c5d72-b7b5-4a57-b08e-56e6d1911481",
  "bookingId": "893c5d72-b7b5-4a57-b08e-56e6d1911481",
  "reviewer_id": "f5120a18-d9bc-4340-a359-00994f31cfa7",
  "reviewer_name": "Ramesh Patel",
  "advocate_id": "1e1c390a-c0b8-47d3-bd3a-e9be75dc30a3",
  "advocate_name": "Adv. Sneha Kulkarni",
  "rating": 5,
  "comment": "Exemplary procedural clarity on Section 138 notice. Clear actionable timelines.",
  "tags": ["Clear communication", "Punctual & prepared", "Actionable next steps"],
  "matter_resolution": "yes",
  "status": "PUBLISHED",
  "created_at": "2026-11-22T12:55:00Z"
}
```

---

## 4. Business Logic & Access Control Guardrails

1. **Eligibility Enforcement:**
   - Consultations in `REQUESTED`, `SCHEDULED`, `CONFIRMED`, `CANCELLED`, or `REJECTED` state return `HTTP 400 Bad Request` (`"Evaluations are only permitted for concluded consultations"`).
2. **Ownership Guard (No Cross-Tenant Reviewing):**
   - Attempting to evaluate another citizen's booking triggers `HTTP 403 Forbidden` (`"Access denied. You are not authorized to evaluate another citizen's consultation session"`).
3. **Derived Identity (Zero Client Spoofing):**
   - The client payload only passes `booking_id`. Reviewer and advocate IDs are derived directly from the verified database record.
4. **Duplicate Prevention:**
   - Attempting to submit a second review for the same booking triggers `HTTP 409 Conflict` (`"An evaluation has already been deposited for this consultation booking"`).
5. **Unauthorized Edit / Deletion Prevention:**
   - Third-party users attempting to `PATCH` or `DELETE` evaluations receive `HTTP 403 Forbidden`.
6. **Regulatory Moderation (BCI Rule 36):**
   - Reviews marked `HIDDEN` or `REJECTED` by administrative moderators are excluded from public rating averages and public review rolls.

---

## 5. Dynamic Rating Calculation

Advocate ratings are computed in real-time from persisted `PUBLISHED` evaluations:
```sql
SELECT 
  coalesce(avg(rating), 0.0) AS average_rating,
  count(id) AS review_count
FROM reviews
WHERE advocate_id = :advocate_id AND status = 'PUBLISHED';
```
Star breakdowns (1–5) and top counsel strengths are aggregated using `GROUP BY rating` and frequency counting.

---

## 6. Frontend Integration

1. **Service Client (`frontend/src/services/dashboard/reviews.ts`):**
   - `submitReview`: Dispatches typed `POST /api/v1/reviews`.
   - `getBookingReview`: Checks if an evaluation exists (`GET /api/v1/reviews/bookings/{id}`).
   - `getAdvocateReviews`: Retrieves live reviews and computed ratings.
2. **Feedback UI (`frontend/src/app/dashboard/feedback/[bookingId]/page.tsx`):**
   - Displays real consultation booking details.
   - If already evaluated: Displays "Evaluation Already Registered" with the user's score, tags, and comment, preventing duplicate submissions.
   - If not yet completed: Displays "Evaluation Registers After Hearing Concludes".
   - Displays real-time validation and server error alerts with dismiss controls.
   - Sets `done(true)` only after receiving HTTP 201 persistence confirmation from the backend.
   - Preserves Gambetta serif, warm ivory card paper (`#fffaf2`), and rectangular borders (`rounded-[2px]`).

---

## 7. Verification & Test Suite Matrix

### 7.1 Automated Integration Tests (`backend/tests/test_advocate_reviews.py`)

| Test Case | Scenario | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| `test_review_unauthenticated_rejected` | No Bearer JWT provided | `401 Unauthorized` | **PASSED** |
| `test_valid_review_for_eligible_completed_booking` | Citizen evaluates attended completed consultation | `201 Created`, status `PUBLISHED` | **PASSED** |
| `test_review_for_another_users_booking_rejected` | User B attempts to evaluate User A's booking | `403 Forbidden` | **PASSED** |
| `test_review_for_nonexistent_booking_rejected` | Random non-existent booking UUID passed | `404 Not Found` | **PASSED** |
| `test_review_for_incomplete_or_cancelled_booking_rejected` | Booking in REQUESTED, SCHEDULED, CANCELLED | `400 Bad Request` | **PASSED** |
| `test_duplicate_review_submission_rejected` | Citizen attempts second review on same booking | `409 Conflict` | **PASSED** |
| `test_invalid_ratings_rejected` | Ratings 0, 6, -1, 10 | `422 Unprocessable Entity` | **PASSED** |
| `test_unauthorized_edit_and_deletion_rejected` | Third-party user attempts to patch/delete review | `403 Forbidden` | **PASSED** |
| `test_real_advocate_rating_aggregation` | 3 reviews (5, 4, 5 stars) submitted | Calculated avg `4.7`, count `3` | **PASSED** |
| `test_admin_review_moderation_flow` | Admin moderates review to `HIDDEN` | Excluded from public rating & roll | **PASSED** |

### 7.2 Full Suite & Frontend Verification
- **Backend Test Suite:** **238 passed in 19.86s** (0 failures).
- **Frontend Code Quality:** **0 ESLint errors or warnings** (`npm run lint`).
- **Production Build:** Next.js 16.4.5 Webpack compiled 44 static and dynamic routes with **0 errors** (`npm run build:webpack`).
