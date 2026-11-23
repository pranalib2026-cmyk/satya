# AI Legal Assistant & Grounded RAG Pipeline — Comprehensive Audit Report

**Audit Date:** November 21, 2026  
**Auditor:** Antigravity Agentic Verification Engine  
**System Scope:** `backend/app/modules/legal_assistant/` & `backend/app/modules/legal_knowledge/`  
**Target Architecture:** Python 3.12 · FastAPI 0.115 · SQLAlchemy 2.0 · PostgreSQL 16 · pgvector · Alembic  
**Standard of Verification:** Rigorous Code Inspection · Zero Assumptions on Mock Behavior  

---

## 1. Executive Summary

NyayaSetu features a structured Retrieval-Augmented Generation (RAG) framework designed to provide grounded legal guidance based on official Indian Bare Acts and court precedents while preventing hallucinations.

However, a technical audit reveals that **the live system is currently running on a completely synthetic mock façade**:
1. **Missing SDK Dependency:** Neither `google-generativeai` nor `google-genai` is declared in `backend/requirements.txt`.
2. **Gating Bug Disables Gemini:** Provider selection logic requires `settings.is_production == True`. In development, Gemini is completely unreachable even with a valid `GEMINI_API_KEY`.
3. **Pseudo-Embeddings in Use:** `DeterministicMockEmbeddingProvider` generates vectors using MD5 token hashing and a 30-word keyword lookup table.
4. **Template Engine Masquerading as LLM:** `DeterministicGroundedLLMProvider` does not use an LLM; it concatenates truncated chunk text with hardcoded `if "138" in sec:` string templates.
5. **pgvector Bypass:** `LegalRetrievalEngine` loads **all database chunks into Python memory** and computes cosine similarity in a Python loop, completely bypassing PostgreSQL's native `pgvector` SIMD operators (`<=>`).
6. **Tiny Corpus:** The entire national legal knowledge base consists of **only 5 statutes and 12 static chunks** in `seed_data.py`.
7. **Test Blindspot:** All 79 test suite cases pass only because they test the deterministic mocks on in-memory SQLite; there are zero tests exercising live Gemini or native pgvector SQL queries.

---

## 2. Component Implementation Status Matrix

| Component | Target Role | Verified Implementation State | Assessment |
|---|---|---|---|
| **Gemini SDK Dependency** | External API integration | Missing from `backend/requirements.txt` | **Missing** |
| **Provider Selection Logic** | Runtime environment router | Hard-gated on `is_production`; blocked in dev | **Incorrectly Configured** |
| **Mock Embedding Provider** | Offline testing fallback | MD5 hashing + 30-word legal index boosts | **Mock / Simulated** |
| **Mock LLM Provider** | Offline testing fallback | String interpolation + hardcoded `if-elif` rules | **Mock / Simulated** |
| **Gemini Embedding Provider** | Semantic dense embeddings | Uses deprecated SDK syntax; task type not dynamic | **Partially Implemented** |
| **Gemini LLM Provider** | Grounded legal synthesis | No Structured Outputs; blindly echoes retrieved context | **Partially Implemented** |
| **Embedding Dimensions** | 768-D Vector matching | Configured as 768-D; matches Gemini 004 | **Fully Implemented** |
| **pgvector Indexing** | Fast similarity search | Column exists; missing HNSW/IVFFlat index in DDL | **Partially Implemented** |
| **Corpus Ingestion** | IndiaCode Bare Act chunking | Pre-chunked static seed (12 chunks total); no parser | **Partially Implemented** |
| **Vector Retrieval Engine** | Hybrid semantic retrieval | Fetches ALL rows into Python; computes math in RAM | **Architectural Loophole** |
| **Citation Validator** | Hallucination pruning | Reconciles claims against retrieved chunks | **Fully Implemented** |
| **Error Fallback System** | Resilient non-advice fallback | Returns safe disclaimers; masks fatal SDK errors | **Fully Implemented** |
| **AI Test Suites** | Quality assurance | 9/9 tests pass against mocks; 0 live tests | **Partially Implemented** |

---

## 3. Deep-Dive Audit of the 12 Focus Areas

### 3.1 Gemini SDK Dependency & Import Behavior
* **Location:** `backend/requirements.txt`, `llm_provider.py` (lines 170–173), `embedding_provider.py` (lines 153–156).
* **Code State:**
  ```python
  try:
      import google.generativeai as genai
      genai.configure(api_key=self._api_key)
      model = genai.GenerativeModel("gemini-1.5-flash")
  except Exception as exc:
      logger.warning(f"Gemini LLM generation failed: {exc}. Using deterministic provider.")
      return self._fallback.generate_legal_answer(query, retrieved_chunks, language)
  ```
* **Vulnerability:** `google-generativeai` is not listed in `backend/requirements.txt`. The dynamic import fails silently with `ModuleNotFoundError`, catches `Exception`, logs a warning, and reverts to the deterministic mock. The application gives the illusion of functioning while Gemini is entirely uninstalled.

### 3.2 Production vs. Development Provider Selection
* **Location:** `llm_provider.py` (lines 228–236) and `embedding_provider.py` (lines 176–186).
* **Code State:**
  ```python
  def get_llm_provider() -> BaseLLMProvider:
      if settings.GEMINI_API_KEY and settings.is_production:
          _llm_provider_instance = GeminiLLMProvider()
      else:
          _llm_provider_instance = DeterministicGroundedLLMProvider()
      return _llm_provider_instance
  ```
* **Vulnerability:** The condition `settings.is_production` (`ENVIRONMENT == "production"`) means that when running locally (`ENVIRONMENT="development"`), the system **strictly ignores `GEMINI_API_KEY`** and always instantiates the deterministic mocks. A developer cannot test live Gemini locally without faking `ENVIRONMENT=production`.

### 3.3 `DeterministicMockEmbeddingProvider` Implementation
* **Location:** `backend/app/modules/legal_assistant/embedding_provider.py` (lines 38–134).
* **How It Operates:**
  1. Translates Indic tokens (e.g., `चेक` $\rightarrow$ `cheque`, `ಗ್ರಾಹಕ` $\rightarrow$ `consumer`).
  2. Applies MD5 hashing across tokens modulo 768 with alternating $\pm 0.1$ signs.
  3. Injects hardcoded semantic cluster boosts for 30 predefined tokens (`"cheque": 10`, `"138": 12`, `"consumer": 30`, `"bail": 70`, `"property": 90`).
  4. Applies L2 unit normalization.
* **Finding:** While effective for in-memory pytest execution without external network calls, it is not an embedding model. Queries with natural synonyms outside the 30 hardcoded terms yield near-zero semantic similarity.

### 3.4 `DeterministicGroundedLLMProvider` Implementation
* **Location:** `backend/app/modules/legal_assistant/llm_provider.py` (lines 30–152).
* **How It Operates:**
  1. If chunks are empty, returns a safe disclaimer: *"No verified legal sources found in the knowledge base..."*.
  2. Iterates over chunks, truncating text to 280 characters:
     `"Under **{source_title}**, **{ref_desc}**, the law provides that: {clean_text}"`.
  3. Injects hardcoded next steps using `if "138" in sec:` / `elif "35" in sec:` / `elif "12" in sec:` / `elif "479" in sec:`.
* **Finding:** It is a rigid string concatenation template engine. It cannot synthesize legal principles, answer open-ended questions, or handle any statute other than the 5 hardcoded if-branches.

### 3.5 Actual Gemini Embedding Integration
* **Location:** `backend/app/modules/legal_assistant/embedding_provider.py` (lines 136–170).
* **Deficiencies:**
  1. Uses the legacy `google.generativeai` package instead of Google's current `google-genai` SDK.
  2. Hardcodes `task_type="retrieval_document"`. For user questions, Gemini embeddings require `task_type="retrieval_query"`. Using the document task type for search queries degrades cosine similarity performance.
  3. `get_embeddings` implements batching via a sequential synchronous Python loop (`[self.get_embedding(t) for t in texts]`), causing severe latency when ingesting large statutory chapters.

### 3.6 Actual Gemini LLM Integration
* **Location:** `backend/app/modules/legal_assistant/llm_provider.py` (lines 154–222).
* **Deficiencies:**
  1. Employs raw text prompt string concatenation without Gemini Structured Outputs (`response_schema`), making JSON parsing fragile.
  2. Lines 201–212 do not extract citations from the LLM output; they simply copy *all* retrieved chunks into `cited_references`, defeating the purpose of LLM reference attribution.
  3. Lacks streaming support (`generate_content_stream`), preventing real-time response rendering on the frontend chat UI.

### 3.7 Embedding & PostgreSQL Vector Dimensions
* **Location:** `backend/app/core/config.py` (`EMBEDDING_VECTOR_DIMENSION = 768`), `backend/app/modules/legal_knowledge/models.py` line 160 (`Vector(768)`).
* **Findings:**
  * Vector dimension is aligned at 768, matching Google's `text-embedding-004`.
  * The column uses `.with_variant(JSON, "sqlite")`, permitting SQLite test execution.
  * **Critical Gap:** No vector index (HNSW or IVFFlat) is declared in `0002_create_core_tables.py` or the SQLAlchemy model. Similarity search performs a sequential table scan.

### 3.8 Legal Document Ingestion & Chunking
* **Location:** `backend/app/modules/legal_knowledge/ingestion.py` and `seed_data.py`.
* **Findings:**
  * **Zero Automated Chunking:** No text splitters (e.g., token-based recursive splitters) exist.
  * All statutory content is pre-chunked manually in Python dictionaries inside `seed_data.py`.
  * **Corpus Scope:** Contains only **5 statutes and 12 total chunks**:
    1. *Negotiable Instruments Act, 1881* — 2 chunks (Sec 138, Sec 142).
    2. *Consumer Protection Act, 2019* — 2 chunks (Sec 2, Sec 35).
    3. *Legal Services Authorities Act, 1987* — 2 chunks (Sec 12, Sec 19).
    4. *Real Estate (Regulation and Development) Act, 2016* — 3 chunks (Sec 18, Sec 19, Sec 31).
    5. *Bharatiya Nagarik Suraksha Sanhita, 2023* — 3 chunks (Sec 479, Sec 480, Sec 482).
  * Inquiries on criminal offenses, matrimonial disputes, cyber law, civil recovery, or contracts return zero sources.

### 3.9 Vector Storage and Retrieval Architecture Flaw
* **Location:** `backend/app/modules/legal_assistant/retrieval.py` (lines 44–140).
* **The Loophole:**
  ```python
  # 1. Fetches EVERY row from the database into Python memory
  stmt = select(LegalChunk).join(LegalSource)...
  res = await db.execute(stmt)
  all_chunks = res.scalars().all()

  # 2. Computes cosine similarity inside a Python for-loop
  for chunk in all_chunks:
      v_score = cosine_similarity(query_vector, chunk.embedding)
  ```
* **Impact:** The code **completely bypasses PostgreSQL's pgvector extension in SQL queries**. Rather than letting PostgreSQL compute `ORDER BY embedding <=> query_vector LIMIT 5` using C/SIMD instructions and spatial vector indexes, it pulls all records across the network into application RAM. At scale (thousands of Bare Act sections), this causes catastrophic memory exhaustion and latency spikes.

### 3.10 Legal Source Citation Generation
* **Location:** `backend/app/modules/legal_assistant/citation_validator.py`.
* **Findings:**
  * **Fully Implemented and Highly Resilient.**
  * Cross-references claimed citations against the actual retrieved context chunks.
  * Prunes hallucinated acts and sections (e.g., strips Section 420 IPC if not retrieved).
  * Attaches official IndiaCode/e-Gazette URLs and content SHA-256 checksums to verified items.

### 3.11 Error Handling and Fallback Behavior
* **Location:** `service.py`, `llm_provider.py`, `embedding_provider.py`.
* **Findings:**
  * Cleanly handles missing sources by returning informational disclaimers without fabricating law.
  * Multi-language support annotates Hindi and Kannada queries with appropriate script prefixes.
  * Audits every query and citation decision into `audit_logs`.
  * **Issue:** Fallbacks catch generic `Exception` and silently degrade to mocks without exposing health metrics to platform administrators.

### 3.12 Existing AI-Related Tests
* **Location:** `backend/tests/test_legal_ai_assistant.py` (9 tests).
* **Findings:**
  * All 9 tests pass with 100% success rate.
  * **The Trap:** Every test passes *only* because tests evaluate the deterministic mock providers against in-memory SQLite. Neither live Gemini API calls, token streaming, nor pgvector SQL distance operators are covered by test assertions.

---

## 4. Current Architecture vs. Target Architecture

```mermaid
flowchart TD
    subgraph CurrentFlow["Current Architecture (Mock Façade)"]
        UserQ1["User Query"] --> LangDetect1["Language Detection"]
        LangDetect1 --> MockEmbed["DeterministicMockEmbeddingProvider (MD5 Hashing)"]
        MockEmbed --> PyRetriever["RetrievalEngine (Pulls ALL chunks into RAM)"]
        PyRetriever --> MockLLM["DeterministicGroundedLLMProvider (String Concatenation)"]
        MockLLM --> Validator1["CitationValidator (Fully Functional)"]
        Validator1 --> Output1["Safe Output (Static Templates)"]
    end

    subgraph TargetFlow["Target Architecture (Production RAG)"]
        UserQ2["User Query"] --> LangDetect2["Language Detection"]
        LangDetect2 --> GeminiEmbed["Gemini Embedding (text-embedding-004 with query task_type)"]
        GeminiEmbed --> PGVectorSQL["PostgreSQL pgvector (HNSW Index + Cosine Operator <=>)"]
        PGVectorSQL --> TopK["Top-K Statutory Chunks"]
        TopK --> GeminiLLM["Gemini 1.5 Flash (Structured Outputs & Streaming)"]
        GeminiLLM --> Validator2["CitationValidator (Grounding Check)"]
        Validator2 --> Output2["Verified Legal Output + Streamed Tokens"]
    end
```

---

## 5. Identified Bugs & Vulnerabilities Summary

| ID | Severity | File | Description |
|---|---|---|---|
| **BUG-01** | **Critical** | `backend/requirements.txt` | Missing `google-generativeai` (or `google-genai`) SDK dependency. |
| **BUG-02** | **Critical** | `llm_provider.py` & `embedding_provider.py` | Provider selection hard-gated on `is_production`, blocking local Gemini development. |
| **BUG-03** | **High** | `retrieval.py` (lines 60–105) | In-memory Python cosine similarity bypasses PostgreSQL `pgvector` SQL distance operators. |
| **BUG-04** | **High** | `0002_create_core_tables.py` | Missing HNSW or IVFFlat vector index on `legal_chunks.embedding`. |
| **BUG-05** | **Medium** | `embedding_provider.py` (line 159) | Static `retrieval_document` task type used for user search queries instead of `retrieval_query`. |
| **BUG-06** | **Medium** | `llm_provider.py` (lines 201–212) | Gemini provider blindly attaches all retrieved chunks as citations rather than parsing LLM output. |
| **BUG-07** | **Medium** | `seed_data.py` | Extremely limited statutory corpus (12 chunks across 5 statutes). |
| **BUG-08** | **Low** | `tests/test_legal_ai_assistant.py` | Test suite exercises only mock providers; zero coverage for live Gemini or pgvector SQL. |

---

## 6. Recommended Incremental Correction Sequence

To systematically transition from the current mock façade to production-grade Grounded RAG without destabilizing the application or breaking existing tests:

### Phase 1: Dependency & Configuration Fixes
1. Add `google-genai` (or `google-generativeai>=0.8.0`) to `backend/requirements.txt`.
2. Update provider factory logic in `llm_provider.py` and `embedding_provider.py`:
   * Allow Gemini activation whenever `settings.GEMINI_API_KEY` is present and non-empty (regardless of `is_production` vs `is_development`).
   * Preserve deterministic providers as an explicit offline fallback when no API key is supplied.

### Phase 2: Native pgvector SQL Retrieval
1. Rewrite `LegalRetrievalEngine.retrieve()` in `retrieval.py`:
   * Execute vector similarity directly in SQL using SQLAlchemy pgvector syntax:
     ```python
     stmt = select(LegalChunk).order_by(LegalChunk.embedding.cosine_distance(query_vector)).limit(max_sources)
     ```
   * Maintain the Python in-memory cosine fallback *strictly* when running under SQLite dialect (`db.bind.dialect.name == "sqlite"`).
2. Generate an Alembic forward migration adding an HNSW index to `legal_chunks.embedding`:
   ```python
   op.create_index(
       "ix_legal_chunks_embedding_hnsw",
       "legal_chunks",
       ["embedding"],
       postgresql_using="hnsw",
       postgresql_with={"m": 16, "ef_construction": 64},
       postgresql_ops={"embedding": "vector_cosine_ops"},
   )
   ```

### Phase 3: Gemini Provider Modernization
1. Update `GeminiEmbeddingProvider` to distinguish `task_type="retrieval_document"` during corpus ingestion from `task_type="retrieval_query"` during user search queries.
2. Upgrade `GeminiLLMProvider` to use Gemini Structured Outputs with a strict Pydantic response schema (`answer`, `cited_sections`, `actionable_steps`).
3. Connect the output citations to `CitationValidator` to ensure only grounded sections reach the user.

### Phase 4: Corpus Expansion & Ingestion Pipeline
1. Ingest core foundational Indian statutes:
   * *Bharatiya Nyaya Sanhita, 2023 (BNS)* / *Indian Penal Code, 1860*
   * *Code of Civil Procedure, 1908 (CPC)*
   * *Indian Contract Act, 1872*
   * *Hindu Marriage Act, 1955* & *Special Marriage Act, 1954*
   * *Arbitration and Conciliation Act, 1996*
2. Build an automated section-level chunker for official IndiaCode XML/PDF feeds.
