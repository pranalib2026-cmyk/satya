# NyayaSetu Document Scanner & Legal Explainer Implementation Guide

**Document Version:** 1.0  
**Effective Date:** November 2026  
**Status:** Implemented & Verified  
**Affected Modules:** `backend/app/modules/documents/`, `backend/app/modules/legal_assistant/`, `frontend/src/services/dashboard/documents.ts`, `frontend/src/app/dashboard/scan/page.tsx`

---

## 1. Architectural Overview & Design Principles

The NyayaSetu document scanner and legal document explainer have been transitioned from static client-side simulations to an end-to-end, multi-tier document vision and statutory analysis pipeline. The system enforces strict compliance with the following core architectural rules:

1. **Single Document Vault Architecture:** The scanner reuses the existing `BaseStorageProvider` and `Document` PostgreSQL entity. Uploaded documents are stored in the private vault (`vault/users/{user_id}/` or `vault/cases/{case_id}/`) using unpredictable object keys. No separate or unmanaged document storage exists.
2. **Authenticated Ownership & Multi-Tenant Isolation:** Every document operation (upload, OCR extraction, legal explanation, download, and deletion) is strictly bound to the authenticated `User`. Cross-tenant access is rejected at both route and database levels with HTTP 403 Forbidden.
3. **Zero Invented Text or Fake Notice Fallbacks:** The pipeline never returns fabricated OCR text or synthetic sample legal notices (such as the legacy Mr. S. Rao / ₹60,000 template) when processing real user uploads. If extraction fails, the document is safely transitioned to status `FAILED` with an auditable error message.
4. **Grounded Statutory Synthesis:** Legal explanations are strictly grounded in retrieved Indian Bare Acts and judicial precedents via `LegalRetrievalEngine`. Claimed citations are verified against actual retrieved chunks using `CitationValidator`. If supporting statutory provisions are not found, the system explicitly states that the explanation cannot be verified against official statutory records.

---

## 2. Document Processing Flow & State Lifecycle

```
[ User Upload (PDF / JPG / PNG) ]
              │
              ▼
[ MIME & Magic Byte Validation ] ──► (Invalid Signature) ──► HTTP 400 Bad Request
              │
              ▼
[ Cryptographic SHA-256 Checksum ]
              │
              ▼
[ Storage Vault Persistence ] ──► (Local Disk or Cloudflare R2)
              │
              ▼
[ PostgreSQL Document Record ] ──► Status: "uploaded"
              │
              ▼
[ Document Vision Pipeline ] ──► Status: "processing"
   ├── Step A: Digital PDF Selectable Stream Extraction (pypdf)
   │     └─ If >= 50 chars of selectable text -> Engine: "pdf_embedded", Confidence: 0.98
   │
   └── Step B: Scanned PDF / Image Optical Extraction
         ├─ Scanned PDF: Rasterize pages at scale 2x to PIL Image (pypdfium2)
         ├─ Engine 1: Google Gemini Vision multimodal API (gemini-2.5-flash) [if configured]
         ├─ Engine 2: RapidOCR ONNX local CPU engine (cross-platform, offline)
         └─ Engine 3: Tesseract OCR fallback (pytesseract) [if binary installed]
              │
              ▼
[ OCR Result Recorded ] ──► Status: "completed" (or "failed" with processing_error)
              │
              ▼
[ Grounded Legal Explainer ] ──► POST /api/v1/documents/{document_id}/explain
   ├── Hybrid Keyword + Vector Retrieval over Indian Statutory Corpus (LegalRetrievalEngine)
   ├── Entity Extraction (Classification, Parties, Dates, Demanded Sums, Obligations, Risks)
   ├── Statutory Citation Verification (CitationValidator)
   └── Audit Logging (DOCUMENT_EXPLAINED)
```

### Document Status Enum
* `uploaded`: File stored in private vault; metadata recorded in PostgreSQL; OCR pending.
* `processing`: OCR extraction actively running in worker execution context.
* `completed`: Text extraction successfully finished. Extracted text, engine name, confidence score, and timestamp saved.
* `failed`: Extraction failed due to corrupt bytes, unsupported formats, password protection, or hardware failure. Safe error message logged in `processing_error`.

---

## 3. Optical Character Recognition (OCR) Engine Architecture

To provide robust execution across cloud, containerized Linux, and offline developer environments, NyayaSetu implements a multi-engine fallback architecture:

| Engine Tier | Implementation | Typical Execution Context | Capabilities |
| :--- | :--- | :--- | :--- |
| **Tier 1: Embedded Text Extractor** | `pypdf.PdfReader` | Digital PDFs with selectable text | 100% character fidelity; zero hallucination; instantaneous stream reading. |
| **Tier 2: Cloud Multimodal Vision** | `google-genai` (`gemini-2.5-flash`) | Production cloud deployment (`AI_PROVIDER="gemini"`) | Transcribes printed & handwritten text, stamps, signatures, and Indic scripts (Hindi, Kannada, Devanagari) with high context accuracy. |
| **Tier 3: Local ONNX OCR Engine** | `rapidocr-onnxruntime` + `Pillow` | Local development, CI/CD, and offline tests | Pure CPU ONNX runtime execution (~15 MB model weight); zero external C binary or Tesseract installation required. |
| **Tier 4: System Tesseract Fallback** | `pytesseract` | Linux containers with `tesseract-ocr` | Traditional optical character recognition if available in system path. |
| **Scanned PDF Rasterizer** | `pypdfium2.PdfDocument` | Scanned PDFs lacking selectable text | High-resolution bitmap rendering (scale=2, ~144-200 DPI) feeding into Tier 2/3 OCR engines. |

### Failure & Edge Case Handling
* **Empty / Blank Documents:** If a user uploads a white canvas or blank scanned page, RapidOCR returns zero detections. The system records `text=""`, `confidence=0.0`, `low_confidence=True`, and `processing_error="No readable text detected in document."`. Calling `/explain` immediately rejects with a clear HTTP 400 Bad Request error.
* **Encrypted / Password-Protected PDFs:** `pypdf` detects encryption and attempts decryption with an empty password. If locked, raises HTTP 400 Bad Request ("PDF document is password-protected and cannot be read").
* **Magic Byte Spoofing:** A file named `notice.pdf` containing random bytes or executable binaries is rejected before processing via magic byte signature validation (`%PDF-`, `\xff\xd8\xff`, `\x89PNG\r\n\x1a\n`).

---

## 4. Grounded Legal Explainer & RAG Synthesis

The explainer takes the actual extracted text from the document and parses statutory obligations without hallucinating dates, parties, or amounts.

### Factual Entity Extraction
* **Document Classification:** Determines document nature (`Section 138 NI Act Demand Notice`, `Tenancy / Lease Notice`, `First Information Report (FIR)`, `Court Summons`, `Consumer Protection Demand`, etc.).
* **Parties:** Extracts sender, recipient, and aggrieved client from structured legal correspondence patterns (`To: ...`, `From: ...`, `Advocate ...`, `Client ...`).
* **Dates & Statutory Windows:** Extracts transaction dates, notice dates, and limitation response windows (`within 15 days`, `within 30 days`).
* **Amounts:** Extracts monetary figures (`Rs. ...`, `₹...`, `INR ...`).
* **Client Obligations:** Extracts required actions (`pay within 15 days`, `vacate premises`, `reply in writing`).
* **Identified Legal Risks:** Flags adverse consequences (`criminal prosecution under Section 138`, `ex-parte decree`, `statutory limitation expiry`).

### Citation Grounding & Traceability
The explainer runs `LegalRetrievalEngine.retrieve()` using the first 400 characters of the extracted document text against the curated Indian legal corpus (including Negotiable Instruments Act 1881, Bharatiya Nagarik Suraksha Sanhita 2023, Consumer Protection Act 2019, Transfer of Property Act 1882, and Limitation Act 1963).
Claimed citations are cross-checked via `CitationValidator.validate_and_filter_citations()`. If the document represents an unrelated topic (e.g., a recipe or generic notice), `sources_found` is set to `False` and no statutory citations are fabricated.

---

## 5. API Endpoints

### 1. Unified Upload & Scan
* **Endpoint:** `POST /api/v1/documents/scan`
* **Content-Type:** `multipart/form-data`
* **Form Fields:** `file` (UploadFile), `case_id` (optional UUID), `document_category` (string, default `"EVIDENCE"`), `is_confidential` (bool, default `true`).
* **Response (HTTP 201 Created):**
```json
{
  "document_id": "84c8fb23-9529-45e0-9bc7-5c4e3650ce89",
  "status": "completed",
  "text": "LEGAL DEMAND NOTICE UNDER SECTION 138 NEGOTIABLE INSTRUMENTS ACT\nTo, Dinesh Patel...\nPay Rs. 85,000 within 15 days...",
  "confidence": 0.98,
  "low_confidence": false,
  "ocr_engine": "pdf_embedded",
  "file_name": "demand_notice_sec138.pdf",
  "file_size_bytes": 1042,
  "mime_type": "application/pdf",
  "processing_error": null,
  "processed_at": "2026-11-22T12:04:26.541Z"
}
```

### 2. Standalone Upload (Without OCR)
* **Endpoint:** `POST /api/v1/documents/upload`
* **Response (HTTP 201 Created):** `DocumentResponse` with `processing_status="uploaded"`.

### 3. Run OCR on Existing Vault Document
* **Endpoint:** `POST /api/v1/documents/{document_id}/ocr`
* **Response (HTTP 200 OK):** `DocumentScanResponse`.

### 4. Query OCR Status & Extracted Text
* **Endpoint:** `GET /api/v1/documents/{document_id}/ocr`
* **Response (HTTP 200 OK):** `DocumentScanResponse`.

### 5. Generate Grounded Legal Explanation
* **Endpoint:** `POST /api/v1/documents/{document_id}/explain`
* **Response (HTTP 200 OK):**
```json
{
  "document_id": "84c8fb23-9529-45e0-9bc7-5c4e3650ce89",
  "document_type": "Statutory Demand Notice (Section 138 Negotiable Instruments Act)",
  "summary": "This document is classified as a Statutory Demand Notice...",
  "parties": ["Dinesh Patel (Recipient)", "Advocate K. Mehta (Sender / Counsel)"],
  "dates": [
    { "label": "Document / Notice date", "value": "10-10-2026" },
    { "label": "Statutory Reply Window", "value": "15 days from receipt" }
  ],
  "amounts": [
    { "label": "Demanded / Stated sum", "value": "₹85,000" }
  ],
  "obligations": [
    "You are hereby called upon to pay Rs. 85,000 within 15 days of this notice, failing which legal proceedings will be initiated."
  ],
  "risks": [
    "Unanswered statutory notices may limit available defenses in civil or criminal proceedings."
  ],
  "citations": [
    {
      "source_title": "Negotiable Instruments Act, 1881",
      "source_type": "BARE_ACT",
      "section_or_paragraph": "Section 138",
      "clause_heading": "Dishonour of cheque for insufficiency, etc., of funds in the account",
      "official_source_url": "https://www.indiacode.nic.in/handle/123456789/2189"
    }
  ],
  "sources_found": true,
  "disclaimer": "NyayaSetu provides an AI-assisted preliminary legal assessment and document explanation. It is not a law firm and does not provide legal advice.",
  "confidence": 0.88,
  "extracted_text_snippet": "LEGAL DEMAND NOTICE UNDER SECTION 138...",
  "created_at": "2026-11-22T12:04:27.102Z"
}
```

---

## 6. Frontend Integration & UI Workflow

### Service Layer (`frontend/src/services/dashboard/documents.ts`)
* Replaced mock `runOcr()` with real `api.upload<BackendScanResponse>('/api/v1/documents/scan', formData)`.
* Replaced mock `explainDocument()` with `api.post<BackendExplanationResponse>('/api/v1/documents/${docId}/explain')`.
* Removed all hardcoded notice text from production responses.

### User Interface (`frontend/src/app/dashboard/scan/page.tsx`)
1. **Interactive File Selection:** Citizen selects JPG, PNG, or PDF file (up to 10MB) via file input or drag-and-drop.
2. **Scanning Stage (`stage === 'ocr'`):** Displays real-time optical scanning spinner and document filename.
3. **Explanation Stage (`stage === 'explain'`):** Displays legal translation status indicator while the grounded RAG service catalogs entities and cross-checks statutory provisions.
4. **Error Alert Banner:** If extraction fails, a dismissible warm alert banner surfaces the exact backend error (e.g. "No readable text detected in document" or "Corrupt file signature") and allows immediate retry.
5. **Results View (`stage === 'done'`):**
   * *Source Document Panel:* Displays high-contrast preview, engine badge (e.g., `pdf_embedded`, `rapidocr`), confidence percentage, and verbatim extracted text.
   * *Analysis Breakdown:* Classification title, plain-language summary, editable party names, editable dates, editable demanded amounts, client obligations, and identified legal risks.
   * *Verified Citations Panel:* Displays traceable statutory sections (e.g., Section 138 NI Act) with official citations.
   * *Limitation Tracker Integration:* Single click records extracted dates into `/deadlines`.

---

## 7. Verification Test Matrix

All tests were executed against real sample documents in [backend/tests/test_document_scanner.py](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/tests/test_document_scanner.py):

| Test Scenario | Sample Input | Expected Behavior | Verification Status |
| :--- | :--- | :--- | :--- |
| **Selectable PDF** | Digital PDF with font stream (`demand_notice_sec138.pdf`) | Extracted via `pypdf`, 98% confidence, Section 138 citation verified | **PASSED** |
| **Scanned PDF** | Image-only PDF with drawn pixels (`scanned_loan_notice.pdf`) | Rasterized via `pypdfium2`, parsed via `RapidOCR`, 98% confidence | **PASSED** |
| **Readable Image** | High-contrast PNG with drawn text (`tenancy_notice.png`) | Processed via `RapidOCR`, tenancy notice classified, ₹35,000 extracted | **PASSED** |
| **Unrelated Document** | Chocolate cake recipe PDF | Extracted faithfully; `sources_found=False`; 0 fake citations | **PASSED** |
| **Corrupt / Unsupported** | Garbage bytes with `.pdf` extension | Magic byte check fails; rejected with HTTP 400 Bad Request | **PASSED** |
| **Document with No Text** | Blank 600x300 white PNG | Extracted text empty; confidence 0.0; `/explain` rejected with HTTP 400 | **PASSED** |
| **Cross-Tenant Access** | User B attempts to access User A's document | Blocked with HTTP 403 Forbidden across `/ocr`, `/explain`, `GET`, `DELETE` | **PASSED** |
| **OCR Engine Failure** | Simulated engine exception | Status updated to `failed`; error persisted in DB; no orphaned files | **PASSED** |

**Full Pytest Suite:** `205 passed, 16 deselected in 16.69s`  
**Frontend Quality Check:** `npm run lint` (0 errors, 0 warnings), `npm run build:webpack` (44/44 pages compiled)
