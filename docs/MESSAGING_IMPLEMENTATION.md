# Chambers Direct Messaging & Confidential Dispatch Architecture

**Status:** Production Ready  
**Date:** November 2026  
**Module:** `backend/app/modules/communication/` & `frontend/src/app/dashboard/messages/`  
**Revision:** `0014_conversations_and_direct_messaging`  

---

## 1. Executive Summary

NyayaSetu has transitioned from simulated client-side mock replies (`frontend/src/services/dashboard/messages.ts`) to an authoritative, persistent chambers communication channel backed by PostgreSQL and FastAPI.

The communication architecture provides:
1. **Persistent Relational Ledger:** Dedicated `conversations` and `messages` tables tracking authorized participants, message delivery, timestamps, attachment metadata, and read synchronization.
2. **Strict Multi-Tenant Isolation:** Guaranteed HTTP 403 Forbidden enforcement blocking unauthorized third parties from accessing or posting to conversations.
3. **Statutory Legal Privilege (BSA 2023 & BCI Rule 36):** Direct communications between citizens and verified advocates are privileged under Sections 126–129 of the Bharatiya Sakshya Adhiniyam, 2023. Non-solicitation rules are preserved by restricting peer-to-peer unsolicited citizen spam.
4. **Editorial Client UI:** Real-time polling synchronization, optimistic message delivery, error handling with dismissal, and Gambetta serif editorial aesthetics.

---

## 2. Relational Database Schema (`0014_conversations_and_direct_messaging`)

### 2.1 `conversations` Table
Tracks confidential bilateral threads between two verified platform participants.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, Index | Unique conversation identifier |
| `participant_one_id` | `UUID` | Foreign Key (`users.id`), Index | Canonical lower UUID participant |
| `participant_two_id` | `UUID` | Foreign Key (`users.id`), Index | Canonical higher UUID participant |
| `case_id` | `UUID` | Foreign Key (`legal_cases.id`), Nullable | Associated legal case docket |
| `appointment_id` | `UUID` | Foreign Key (`appointments.id`), Nullable | Associated consultation appointment |
| `subject` | `VARCHAR(255)` | Nullable | Topic or matter description |
| `status` | `VARCHAR(32)` | Default: `'ACTIVE'`, Index | `'ACTIVE'`, `'BLOCKED'`, or `'ARCHIVED'` |
| `blocked_by_id` | `UUID` | Foreign Key (`users.id`), Nullable | Participant who severed inbound dispatches |
| `last_message_at` | `TIMESTAMPTZ` | Index, Default: `now()` | Timestamp of most recent dispatch |
| `created_at` | `TIMESTAMPTZ` | Index, Default: `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Default: `now()` | Last modification timestamp |

*Constraints:* `CheckConstraint("participant_one_id != participant_two_id")`, `Index("idx_conversations_participants", ["participant_one_id", "participant_two_id"])`.

---

### 2.2 `messages` Table
Tracks individual messages with read status and attachments.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, Index | Unique message UUID |
| `conversation_id` | `UUID` | Foreign Key (`conversations.id`), Index | Parent thread identifier |
| `sender_id` | `UUID` | Foreign Key (`users.id`), Index | Authenticated message sender |
| `content` | `TEXT` | Nullable: `False` | 1–5,000 character validated text |
| `attachment_name` | `VARCHAR(255)` | Nullable | Document label / vault file name |
| `attachment_document_id` | `UUID` | Foreign Key (`documents.id`), Nullable | Vault document cryptographic reference |
| `is_read` | `BOOLEAN` | Index, Default: `False` | Read receipt flag |
| `read_at` | `TIMESTAMPTZ` | Nullable | Exact timestamp message was marked read |
| `delivery_status` | `VARCHAR(32)` | Default: `'DELIVERED'` | Delivery state (`'DELIVERED'`, `'READ'`) |
| `created_at` | `TIMESTAMPTZ` | Index, Default: `now()` | Message submission timestamp |
| `updated_at` | `TIMESTAMPTZ` | Default: `now()` | Modification timestamp |

*Indexes:* `Index("idx_messages_conversation_created", ["conversation_id", "created_at"])`, `Index("idx_messages_unread", ["conversation_id", "sender_id", "is_read"])`.

---

## 3. API Specification & Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/conversations` | Lists current user's conversations with unread badges | Yes (Bearer JWT) |
| `POST` | `/api/v1/conversations` | Starts or fetches thread with recipient (User or Advocate Profile ID) | Yes (Bearer JWT) |
| `GET` | `/api/v1/conversations/{id}` | Retrieves conversation metadata (participant verification) | Yes (Bearer JWT) |
| `GET` | `/api/v1/conversations/{id}/messages` | Paginated chronological message log | Yes (Bearer JWT) |
| `POST` | `/api/v1/conversations/{id}/messages` | Sends a persistent message into the conversation thread | Yes (Bearer JWT) |
| `POST` | `/api/v1/conversations/{id}/read` | Marks unread messages from the other participant as read | Yes (Bearer JWT) |
| `POST` | `/api/v1/conversations/{id}/block` | Blocks conversation and severs inbound communication | Yes (Bearer JWT) |
| `POST` | `/api/v1/conversations/{id}/report` | Submits grievance notice for compliance review (AuditLog) | Yes (Bearer JWT) |

---

## 4. Security & Access Control Matrix

1. **Multi-Tenancy Guard:**
   - Every read and write operation checks `current_user.id in (conversation.participant_one_id, conversation.participant_two_id)`.
   - Third-party users receive an explicit `HTTP 403 Forbidden` (`app.core.errors.ForbiddenException`).
2. **Anti-Harassment & Spam Prevention:**
   - Self-messaging is prohibited (`participant_one_id != participant_two_id`).
   - Unsolicited direct messaging between unrelated citizens without a shared matter is rejected with `HTTP 403 Forbidden`.
   - Blocked conversations instantly reject outbound messages with `HTTP 400 Bad Request`.
3. **Payload Sanitization:**
   - Whitespace-only messages and messages exceeding 5,000 characters are rejected with `HTTP 422 Unprocessable Entity`.

---

## 5. Dashboard Overview Counter Synchronization

The unified dashboard overview endpoint (`GET /api/v1/dashboard/summary`) calculates `unread_messages` directly in SQL:
```sql
SELECT count(*) FROM messages 
JOIN conversations ON messages.conversation_id = conversations.id
WHERE (conversations.participant_one_id = :user_id OR conversations.participant_two_id = :user_id)
  AND messages.sender_id != :user_id
  AND messages.is_read = FALSE;
```
When an advocate or citizen reviews the active thread, `POST /api/v1/conversations/{id}/read` executes an atomic bulk update:
```sql
UPDATE messages SET is_read = TRUE, read_at = now(), delivery_status = 'READ'
WHERE conversation_id = :conv_id AND sender_id != :user_id AND is_read = FALSE;
```
This guarantees zero stale counts without in-memory hydration.

---

## 6. Verification & Test Execution

### 6.1 Backend Test Suite (`pytest`)
All 228 automated integration tests pass in 19.34 seconds:
```text
============================= test session starts ==============================
rootdir: /Users/yashodhan/Documents/Projects/NyayaSetu/backend
collected 228 items

tests/test_advocate_matching.py ..........                               [  4%]
tests/test_advocate_registration_verification.py ..........              [  8%]
tests/test_advocate_verification.py ..........                           [ 13%]
tests/test_ai_evaluation_framework.py ................                   [ 20%]
tests/test_ai_provider_config.py ............                            [ 25%]
tests/test_auth.py ...........                                           [ 30%]
tests/test_case_intake_triage.py ..........                              [ 34%]
tests/test_dashboard_summary.py ......                                   [ 37%]
tests/test_database.py ......                                            [ 39%]
tests/test_document_scanner.py ........                                  [ 43%]
tests/test_documents_appointments_deadlines.py ..........                [ 47%]
tests/test_gemini_llm_provider.py ..........                             [ 52%]
tests/test_health.py ...                                                 [ 53%]
tests/test_legal_ai_assistant.py .........                               [ 57%]
tests/test_legal_corpus_domains.py .................                     [ 64%]
tests/test_legal_document_ingestion.py ............                      [ 70%]
tests/test_messaging.py .......                                          [ 73%]
tests/test_profile_and_privacy.py ..........                             [ 77%]
tests/test_rag_pipeline_advanced.py .......                              [ 80%]
tests/test_semantic_embeddings.py ............                           [ 85%]
tests/test_storage_migration_script.py ...........                       [ 90%]
tests/test_storage_r2.py .....................                           [100%]

============================= 228 passed in 19.34s =============================
```

### 6.2 Frontend Code Quality & Production Build
- `npm run lint`: **0 errors, 0 warnings**.
- `npm run build:webpack`: Compiled all 44 Next.js 16 pages and routes cleanly.
