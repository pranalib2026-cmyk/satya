# SATYA (NyayaSetu) — Complete Local Functional Test Report

**Date:** 2026-11-25  
**Repository:** `c:\Users\Asus\legal\Satya_new` (`https://github.com/sarthakchillal20/Satya.git`)  
**Machine-Readable Evidence:**
- Latest full-stack & post-fix verification: [`satya_complete_functional_test_results.json`](file:///C:/Users/Asus/legal/Satya_new/reports/satya_complete_functional_test_results.json)
- Pre-fix 27-query baseline across 12 legal domains: [`live_backend_test_results.json`](file:///C:/Users/Asus/legal/Satya_new/reports/live_backend_test_results.json)

---

## 1. Executive Summary

SATYA (NyayaSetu) was configured, started, and tested locally across its FastAPI modular monolith backend (`:8000`) and Next.js 16.4.5 frontend (`:3000`) using a local SQLite database (`sqlite+aiosqlite:///./nyayasetu_local.db`) populated with **70 legal sources and 159 vector chunks** embedded via live Google Gemini (`gemini-embedding-001`, 768 dimensions) and tested against live Gemini generation (`gemini-3.5-flash`, `gemini-3.5-flash-lite`, and `gemini-2.5-flash-preview-tts`).

### Key Verdicts
- **Core Legal Assistant (`/api/v1/legal/ask`, `/ask-me`, `/ask-me/stream`, `/upload-context`, `/speak`)**: **WORKING** end-to-end with Next.js proxy -> FastAPI -> SQLite corpus + Gemini embeddings/LLM/TTS, including inline citations, statutory currency warnings, and SSE streaming.
- **Document Vault & Scanner (`/documents/scan`, `/documents/{id}/explain`, `/documents/cases/{id}/upload`)**: **WORKING** after fixing a live Gemini JSON schema incompatibility (`additionalProperties` rejected by Gemini Developer API).
- **Citizen Workflows (Auth JWT, DPDP Consent & Export, Triage, Cases, Deadlines)**: **WORKING** against real persisted SQLite tables.
- **Bugs Found & Fixed During Testing**: **7 genuine issues fixed and re-verified** (4 in backend RAG/citations/schemas, 2 in ingestion/local DB setup, 1 environment recovery for corrupted `node_modules` + `--webpack` execution on Windows).
- **Remaining Gaps / Partially Working Areas**:
  1. `/dashboard/chat` frontend page still imports hardcoded mock responses (`chat-assistant.ts`) instead of calling `chat.ts` (`/api/v1/legal/ask`).
  2. Mobile OTP login is UI-mocked (`mock.jwt.*`); email/password login is real backend JWT.
  3. Local advocate directory has `0` seeded/approved `AdvocateProfile` rows, so live advocate matching/booking returns empty arrays and UI falls back to mock advocates.
  4. Interactive Chromium DevTools DOM/console clicks could not run because Chrome remote debugging (`DevToolsActivePort`) was unavailable and `playwright` was not installed; frontend verification therefore covered clean lint, build, service tests, all 26 SSR HTML route renders (11 public + 15 cookie-authenticated dashboard routes), and live Next.js-to-FastAPI HTTP/SSE proxying.
  5. PostgreSQL 16 + pgvector (`localhost:5432`) and Docker are not installed on this host, so full 17,202-chunk PostgreSQL HNSW ingestion could not run locally.

---

## 2. Environment & Setup Findings

| Component | Configuration Tested | Finding / Notes |
|---|---|---|
| Python Runtime | `Satya_new\.venv` (Python 3.12.10) | Clean virtual environment with all `backend/requirements.txt` dependencies installed (`pypdf=True`). |
| Local Database | `sqlite+aiosqlite:///./nyayasetu_local.db` | PostgreSQL (`localhost:5432`) and `psql`/Docker are unavailable on this host. Production PostgreSQL/pgvector configs in [`config.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/core/config.py) were preserved unchanged; [`database.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/core/database.py) enables SQLite fallback only when `DATABASE_URL` starts with `sqlite`. |
| Populated Test Corpus | 70 `LegalSource` rows, 159 `LegalChunk` rows | 20 curated central statutes (50 chunks) + 47 multi-domain external docs (106 chunks) + 3 Belagavi HC records (3 chunks), all embedded via live `gemini-embedding-001`. Idempotency confirmed (`0` duplicates inserted on repeat run). |
| Gemini Models on Current Key | `gemini-embedding-001`, `gemini-3.5-flash-lite`, `gemini-2.5-flash-preview-tts` | `text-embedding-004`, `gemini-2.5-flash`, and `gemini-2.5-flash-lite` returned `404 NOT_FOUND` on this API key; `gemini-3.5-flash` hit its 20 RPD Free Tier quota mid-session; `gemini-3.5-flash-lite` had live quota and handled post-fix generation checks (with automatic fallback to `DeterministicGroundedLLMProvider` only when Google returned transient `503 UNAVAILABLE`). |
| Frontend Build/Dev Engine | Next.js 16.4.5 (`npx next dev --webpack` & `npm run build:webpack`) | Default Turbopack crashes on this Windows host (`@next/swc-win32-x64-msvc.node` invalid Win32 binary); `--webpack` dev and production build succeed cleanly. Initial `node_modules` lacked `lucide-react` and `hermes-parser/dist/index.js` and was repaired with clean `npm install`. |

---

## 3. Feature-Wise Functional Status Matrix

| Feature | Status | Frontend Wiring | Backend / DB / Gemini Evidence | Notes & Limitations |
|---|---|---|---|---|
| Public Pages (`/`, `/contact`, `/disclaimer`, `/firm`, `/insights`, `/matters`, `/people`, `/practices`, `/privacy`) | **WORKING** | Next.js App Router pages compiled & rendered | All `11/11` public routes returned HTTP `200 OK`, `error_marker=false` (`/`, 126 KB, through `/privacy`, 62 KB). | Static/SSG + SSR rendered cleanly (`45/45` static pages in `next build --webpack`). |
| Auth — Email/Password & JWT | **WORKING** | [`/login`](file:///C:/Users/Asus/legal/Satya_new/frontend/src/app/login/page.tsx) calls `auth.ts` -> `/api/v1/auth/*` | `POST /auth/register` (`201`), `POST /auth/login` (`200`), `GET /auth/me` (`200`), `POST /auth/refresh` (`200`), unauth `GET /auth/me` (`401`). | Middleware enforces `nyayasetu_token` cookie on `/dashboard/*` (`307` -> `/login?from=...` verified). |
| Auth — Mobile SMS OTP | **NOT IMPLEMENTED** | [`/login`](file:///C:/Users/Asus/legal/Satya_new/frontend/src/app/login/page.tsx) OTP flow | Client-only mock generating `mock.jwt.*` token in `services/auth.ts`. | No backend SMS OTP route implemented. |
| Citizen Ask-Me Workspace (`/ask-me`) | **WORKING** | [`ask-me-client.tsx`](file:///C:/Users/Asus/legal/Satya_new/frontend/src/components/ask-me/ask-me-client.tsx) -> `services/ask-me.ts` | `POST /api/v1/legal/ask-me/stream` via Next proxy (`http://localhost:3000/api/v1/legal/ask-me/stream`) returned `200 OK`, **35 SSE events** (`meta` + `delta` + `done`) with live `gemini-3.5-flash-lite`. | Offline fallback array activates only if backend fetch fails. |
| Ask-Me Context Upload (`/ask-me`) | **WORKING** | Multipart form upload in [`services/ask-me.ts`](file:///C:/Users/Asus/legal/Satya_new/frontend/src/services/ask-me.ts) | `POST /api/v1/legal/ask-me/upload-context` with synthetic PDF `notice_138.pdf` -> `200 OK`, extracted `299` chars via `pdf_embedded` in `353.7ms`. | Tested PDF extraction directly. |
| Ask-Me Voice TTS (`Speak`) | **WORKING** | Audio playback via `/api/v1/legal/ask-me/speak` | `POST /api/v1/legal/ask-me/speak` -> `200 OK` (`4271.3ms`), returned live `RIFF/WAVE` binary audio from `gemini-2.5-flash-preview-tts`. | Live Gemini TTS verified. |
| Ask-Me Voice STT (`Transcribe`) | **PARTIALLY WORKING** | Mic upload via `/api/v1/legal/ask-me/transcribe` | Empty audio rejected cleanly with `400 BAD_REQUEST` (`"Recorded audio file is empty."`). | End-to-end spoken `.webm` audio transcription was not executed against real microphone audio. |
| Grounded RAG Query (`/api/v1/legal/ask`) | **WORKING** | Also exposed via `services/dashboard/chat.ts` | Baseline: `27/27` queries across 12 domains returned `200 OK`; Post-fix re-tests verified accurate retrieval, domain disambiguation, and source-aware ranking. | 3 concurrent proxy requests returned `200 OK` (`22.87s–22.90s`; 2 served live by `gemini-3.5-flash-lite`, 1 automatically fell back cleanly after Google `503`). |
| Citation Validation & Pairing | **WORKING** | Rendered as citation cards with URLs & verification pills | **Fixed** `chunk_map` collision bug in [`citation_validator.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/modules/legal_assistant/citation_validator.py); `Jibangshu Paul` & `RERA Sec 18` paired cleanly with accurate `official_source_url` and `relevant_text`. | Pruned ungrounded section mentions (`CrPC 482`, `Section 2 (k)`) automatically in live logs. |
| Hallucination & False-Citation Defense | **WORKING** | Grounded `sources_found=false` safe fallback message | **6/6 hallucination tests passed** (`sources_found=False`, `citations=[]`) plus `Karnataka Land Revenue Act Sec 27` (`found=False`, `chunks=0`). | 4 non-existent statutes/sections blocked at retrieval (`chunks=0`); 2 fabricated amendments/cases refused live by `gemini-3.5-flash-lite`. |
| Statutory Currency & Amendment Tags | **WORKING** | Propagated in citation metadata & warnings | `IPC vs BNS 2023` live Gemini stated IPC repealed w.e.f. 1 July 2024; `Constitution 105th/106th` explicitly noted Dec 2020 PDF cutoff; Belagavi HC tagged `HISTORICAL_PRECEDENT_CITES_IPC_CRPC`. | Repealed laws excluded or explicitly flagged unless historically queried. |
| Multilingual Support (`en`, `hi`, `kn`, `mr`) | **PARTIALLY WORKING** | Language selector & auto-detection | `detect_language` returned exact `hi`, `kn`, `mr` (**fixed** Marathi detection). Live `gemini-3.5-flash-lite` generated full native Kannada (`kn`, `9041ms`) and Marathi (`mr`, `15282ms`). | `hi` query hit transient 3x Google `503` during retest and returned deterministic fallback (`(हिंदी सारांश)` header + English statute text). |
| Dashboard AI Chat (`/dashboard/chat`) | **PARTIALLY WORKING** | [`dashboard/chat/page.tsx`](file:///C:/Users/Asus/legal/Satya_new/frontend/src/app/dashboard/chat/page.tsx) SSR `200 OK` | Page renders cleanly (`69 KB` HTML) when authenticated, **but imports hardcoded mock `chat-assistant.ts`** instead of `services/dashboard/chat.ts`. | Architectural gap left documented per no-redesign scope. |
| Legal Triage (`/dashboard/triage`) | **WORKING** | `/dashboard/triage` SSR `200 OK` | `POST /api/v1/triage/assess` -> `200 OK` (`39.5ms`), identified `"Cheque Bounce (Sec 138 NI Act)"`, JMFC Belagavi jurisdiction, `STANDARD_30D`. | Requires `title` & `legal_issue_category` per `CaseCreateRequest`. |
| Case Management (`/dashboard/cases`, `/brief`, `/intake`) | **WORKING** | Authenticated SSR `200 OK` | `POST /api/v1/cases` -> `201 Created` (`NYA-2026-CS-5EFC`); `GET /api/v1/cases` -> `200 OK` (`total: 1` persisted in SQLite). | Triage result automatically attached on creation. |
| Statutory Deadlines (`/dashboard/deadlines`) | **WORKING** | Authenticated SSR `200 OK` | `POST /api/v1/deadlines` -> `201 Created` (`[7, 3, 1]` day scheduled alerts); `GET /api/v1/deadlines` -> `200 OK` (`total: 1`). | Deterministic limitation math verified (`test-services.mjs` 1/8). |
| Document Scanner & AI Explain (`/dashboard/scan`) | **WORKING** | Authenticated SSR `200 OK` | `POST /api/v1/documents/scan` -> `201 Created` (`0.98` confidence); `POST /api/v1/documents/{id}/explain` **fixed** and verified **live** with `gemini-3.5-flash-lite` (`200 OK`, `5562.3ms`). | Extracted exact parties (`Ramesh Rao`, `Suresh Kulkarni`), dates, `Rs 150000`, and verified NI Act Sec 138 citation. |
| Confidential Document Vault (`/dashboard/vault`) | **WORKING** | Authenticated SSR `200 OK` | `POST /api/v1/documents/cases/{case_id}/upload` -> `201 Created`, local storage key + SHA-256 checksum persisted. | Uses `STORAGE_PROVIDER=local`. |
| DPDP Consents & Data Export (`/dashboard/profile`) | **WORKING** | Authenticated SSR `200 OK` | `POST /users/me/consents` (`201 Created`, `consent_type="dpdp"`), `GET /users/me/consents` (`200 OK`), `POST /users/me/data-export` (`200 OK`, full export JSON keys). | Audit metadata (`ip_address`, `user_agent`) recorded. |
| Advocate Matching, Bookings & Messages (`/dashboard/advocates`, `/bookings`, `/messages`) | **PARTIALLY WORKING** | Authenticated SSR `200 OK` | `GET /matching/advocates?city=Belagavi`, `/matching/cases/{id}/advocates`, `/appointments`, `/conversations` all returned `200 OK` (`0` rows). | Local DB has `0` approved `AdvocateProfile` rows; UI falls back to mock advocates when list is empty. |
| Headless Browser UI Interaction | **NOT TESTED** | All 26 SSR HTML routes verified | `chrome_devtools` failed (`DevToolsActivePort` missing) and `playwright` is not installed locally. | Live DOM click/console errors remain unverified inside a rendered Chrome window. |

---

## 4. Bugs Identified, Root Causes & Verified Fixes

1. **Bug #1 — Wrong Metadata/URL Cross-Contamination in `CitationValidator` (FIXED & VERIFIED)**
   - *File:* [`citation_validator.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/modules/legal_assistant/citation_validator.py)
   - *Root Cause:* `chunk_map` keyed retrieved chunks by standalone `sec` (e.g., `"Judgment Summary"`, `"Section 18"`), overwriting earlier chunks when multiple citations shared a label.
   - *Fix:* Indexed chunks by `(title_lower, sec_lower)` in `pair_map` and `title_map` using `setdefault`, preferring exact `(title, section)` lookup first.
   - *Verification:* Retested `Jibangshu Paul` and `RERA Section 18`; every citation now carries its own `official_source_url`, `source_repository_url`, and `relevant_text`.

2. **Bug #2 — Missing Model Registry Import in Ingestion CLI (FIXED & VERIFIED)**
   - *File:* [`ingest_legal_document.py`](file:///C:/Users/Asus/legal/Satya_new/backend/scripts/ingest_legal_document.py)
   - *Root Cause:* Missing `import app.core.models` before ORM queries caused SQLAlchemy `InvalidRequestError: 'Appointment' failed to locate a name`.
   - *Fix & Verification:* Imported `app.core.models` at startup; slice ingestion (`47 docs / 106 chunks`) and Belagavi ingestion (`3 docs / 3 chunks`) completed and verified idempotent (`0` duplicates on re-run).

3. **Bug #3 — Neural Cosine Noise & Non-Existent Section/Act Hallucination Leakage (FIXED & VERIFIED)**
   - *File:* [`retrieval.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/modules/legal_assistant/retrieval.py)
   - *Root Cause:* Non-mock `gemini-embedding-001` baseline cosine similarity (`~0.65–0.70`) pushed unrelated chunks above `0.45`, and missing sections (`Section 9999 BNS`, `Section 777 DPDP`) or missing Acts (`Karnataka Rent Act`, `Karnataka Land Revenue Act`, `Wealth-tax Act Section 3`) matched generic Act words.
   - *Fix:* Added non-mock meaningful lexical overlap guard (bypassing cross-lingual Indic queries so `hi/kn/mr` retrieval remains intact), explicit section/article penalty (`-0.40`), and hyphen-aware named-Act phrase guard (`-0.45`).
   - *Verification:* All `6/6` hallucination queries + `Karnataka Land Revenue Act Section 27` + `Wealth-tax Act Section 3` cleanly returned `sources_found=False`, `citations=[]`.

4. **Bug #4 — Contradictory `citations` When `sources_found=False` & Dropped Judgment Citations (FIXED & VERIFIED)**
   - *Files:* [`service.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/modules/legal_assistant/service.py), [`llm_provider.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/modules/legal_assistant/llm_provider.py)
   - *Root Cause:* (a) Even when LLM set `sources_found=False`, `service.py` still returned `verified_citations`; (b) `_build_claimed_references` missed `COURT_JUDGMENT` / `GOVERNMENT_SCHEME` chunks when answers named case titles rather than `"Judgment Summary"`.
   - *Fix & Verification:* Cleared `verified_citations = []` when `llm_output["sources_found"]` is false, and matched judgment/scheme title tokens in `_build_claimed_references`. Verified live on `Kesavananda Bharati`, `IT Rules 2021`, `2026 Citizenship Amendment`, `Sharma vs Moonbase Logistics` (`found=False`, `cits=0`), and `Jibangshu Paul` (`found=True`, `cits=5`).

5. **Bug #5 — Gemini Developer API Rejection of `explain_legal_document` Schema (FIXED & VERIFIED)**
   - *File:* [`llm_provider.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/modules/legal_assistant/llm_provider.py)
   - *Root Cause:* `GroundedDocumentExplanationSchema` used `List[Dict[str, str]]` for `dates` and `amounts`, emitting JSON Schema `additionalProperties`, which Gemini Developer API rejects with `ClientError: additionalProperties is only supported in Gemini Enterprise Agent Platform mode`.
   - *Fix & Verification:* Replaced raw dicts with explicit `DocumentDateItem` and `DocumentAmountItem` Pydantic models and `.model_dump()`. Retested `POST /api/v1/documents/{id}/explain` -> live `gemini-3.5-flash-lite` returned `200 OK` (`5562.3ms`) with extracted parties, dates, amounts, and Section 138 citation.

6. **Bug #6 — Marathi (`mr`) Misclassified as Hindi (`hi`) & Missing Marathi Prompt/Disclaimer (FIXED & VERIFIED)**
   - *Files:* [`service.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/modules/legal_assistant/service.py), [`llm_provider.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/modules/legal_assistant/llm_provider.py), [`retrieval.py`](file:///C:/Users/Asus/legal/Satya_new/backend/app/modules/legal_assistant/retrieval.py)
   - *Fix & Verification:* Added Marathi lexical markers, preferred `"mr"` support, expanded Indic-to-English retrieval keywords (`धनादेश`, `तक्रार`, `जामीन`), and added Marathi prompt/fallback rules. Live query in Marathi detected `detected_language="mr"` and produced fluent native Marathi Section 138 guidance.

7. **Bug #7 — Corrupted Frontend `node_modules` & Windows Turbopack Binary Issue (DIAGNOSED & MITIGATED)**
   - *Root Cause:* Missing `lucide-react` & `hermes-parser/dist/index.js` caused SSR 500s and ESLint crash; `@next/swc-win32-x64-msvc.node` is invalid Win32 binary for Turbopack on this machine.
   - *Fix & Verification:* Reinstalled packages cleanly via `npm install`, verified `npm run lint` (exit `0`), `npx next dev --webpack` (`26/26` routes `200 OK`), and `npm run build:webpack` (exit `0`, `45/45` static pages).

---

## 5. Detailed Verification Gate Results (Post-Final-Edits)

| Verification Gate | Command / Scope | Exact Observed Result |
|---|---|---|
| Backend Full Test Suite (Standard Defaults) | `$env:AI_PROVIDER='mock'; $env:DATABASE_URL='postgresql+psycopg://postgres:postgres@localhost:5432/nyayasetu'; $env:GEMINI_LLM_MODEL='gemini-2.5-flash'; $env:GEMINI_EMBEDDING_MODEL='text-embedding-004'; pytest -q --tb=short` | **254 passed in 350.54s** (`0` failed, `0` skipped) |
| Backend Suite With Local `.env` Active | `AI_PROVIDER=mock` only (without overriding `.env` SQLite/Gemini-3.5 model names) | `250 passed, 4 failed` (the 4 failures strictly assert hardcoded default names `psycopg3`, `gemini-2.5-flash`, `text-embedding-004` overridden by local dev `.env`) |
| Frontend ESLint | `cd Satya_new\frontend; npm run lint` | Exited `0` (zero errors) |
| Frontend Service Logic Suite | `cd Satya_new\frontend; node scripts/test-services.mjs` | **8/8 passed** (deadline math, matching weights, triage routing, ICS export, phone E.164, env leak check, RBAC, citations) |
| Frontend Production Webpack Build | `cd Satya_new\frontend; npm run build:webpack` | Exited `0`; compiled in `35.5s`, TypeScript in `14.2s`, generated `45/45` static pages |
| Live HTTP + Next.js Proxy + Gemini E2E | `run_comprehensive_live_tests.py` against `:3000` -> `:8000` | `11/11` public routes `200`; `15/15` authenticated `/dashboard/*` routes `200`; Auth/DPDP/Workflows/Docs/SSE/Voice/RAG/Validation all `200`/`201`/`422` as expected |

---

## 6. Recommended Next Steps (Outside Current Testing Scope)
1. Wire [`dashboard/chat/page.tsx`](file:///C:/Users/Asus/legal/Satya_new/frontend/src/app/dashboard/chat/page.tsx) to `streamAnswer()` in [`services/dashboard/chat.ts`](file:///C:/Users/Asus/legal/Satya_new/frontend/src/services/dashboard/chat.ts) (or a `/api/v1/legal/ask-me` adapter) so the authenticated dashboard chat uses live RAG instead of mock responses.
2. Seed verified sample `AdvocateProfile` rows (e.g. Belagavi & Bengaluru) or complete the advocate onboarding workflow to test live matching, appointments, and conversations end-to-end.
3. Update `backend/tests/conftest.py` to pin test-default `DATABASE_URL`, `GEMINI_LLM_MODEL`, and `GEMINI_EMBEDDING_MODEL` so `pytest` stays insulated from developer `.env` overrides.
4. Once PostgreSQL 16 + `pgvector` is running, execute `python scripts/ingest_legal_document.py --ingest-processed` to load the full 6,873-document / 17,202-chunk corpus and test HNSW retrieval latency at scale.
