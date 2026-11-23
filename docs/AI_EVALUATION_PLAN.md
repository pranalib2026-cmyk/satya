# NyayaSetu (न्यायसेतु) — AI Legal Assistant Evaluation & Benchmarking Plan

**Document Purpose:** Comprehensive Evaluation Framework for Grounded Legal Intelligence  
**Effective Date:** November 21, 2026  
**Evaluation Scope:** Retrieval Accuracy · Citation Fidelity · Grounded Synthesis · Abstention Reliability · Version Transition · Security & Robustness · Reliability  
**Target Architecture:** FastAPI · PostgreSQL 16 · pgvector · Google GenAI (`text-embedding-004` & `gemini-2.5-flash`)  

---

## 1. Executive Summary & Objective

The primary requirement of an Indian legal technology platform is **strict grounding in authoritative primary sources**. An AI assistant that generates eloquent but legally inaccurate, outdated, or fabricated statutory answers creates severe legal risk for citizens and advocates.

This evaluation framework establishes rigorous, repeatable benchmarks across **7 evaluation categories** and **12 core Indian legal domains**. The objective is to evaluate whether the AI assistant's answers are **strictly grounded** in retrieved verified statutes, whether citations are **cryptographically traceable**, whether the model **correctly abstains** when sources are absent, and how the system withstands **prompt injection and system faults**.

> [!CRITICAL]
> **Statutory Disclaimer on AI Evaluation:**  
> This automated evaluation framework measures algorithmic grounding, semantic retrieval precision, lexical section matching, citation traceability, and adversarial security. It is an engineering verification tool and **does not constitute legal certification or formal legal advice**. Automated metrics cannot replace qualitative statutory review by an empanelled, qualified advocate enrolled with the Bar Council of India.

---

## 2. Seven Evaluation Categories

### Category 1: Retrieval Accuracy
Evaluates the ability of `LegalRetrievalEngine` to retrieve relevant legal provisions:
* **Act Precision:** Does the top candidate originate from the correct legislative Act?
* **Section Precision:** Does the candidate chunk contain the exact governing Section or Article?
* **Multi-Statute Co-Retrieval:** Can the engine retrieve complementary provisions across distinct Acts when a dispute spans multiple legal regimes (e.g., *Indian Contract Act, 1872* and *Limitation Act, 1963*)?
* **Disambiguation:** Does the engine avoid cross-statute section collisions (e.g., correctly distinguishing Section 12 of PWDVA from Section 12 of NALSA)?

### Category 2: Citation Accuracy & Traceability
Evaluates the integrity of returned statutory citations:
* **Existence in Corpus:** Does every cited section exist in the retrieved context?
* **Text Concordance:** Does the extracted snippet in `relevant_text` match the statutory text in the database?
* **Official URL Fidelity:** Does `official_source_url` point to an accredited government repository (`indiacode.nic.in`, `mha.gov.in`, `nalsa.gov.in`, `meity.gov.in`)?
* **Cryptographic Checksum:** Does the citation provide a matching SHA-256 digest of the underlying source chunk?

### Category 3: Grounded Answer Quality
Evaluates synthesis quality without relying merely on linguistic fluency:
* **Supported Claim Rate:** The proportion of legal claims in the answer supported by retrieved context chunks.
* **Unsupported Claim Rate:** The proportion of legal assertions introducing unverified sections, rules, or procedural conclusions.
* **Separation of General Information vs Case Specifics:** Does the response distinguish general statutory requirements (e.g., notice within 30 days) from matter-specific court determinations?

### Category 4: Missing Information & Abstention Behavior
Evaluates the platform's safety protocol when corpus coverage is absent:
* **Zero-Hallucination Abstention:** Does the system explicitly set `sources_found = False` and state that the knowledge base lacks sufficient verified statutory records?
* **Missing Facts Questionnaire:** Does the system prompt the user for necessary facts (jurisdiction, transaction dates, executed agreements) rather than guessing?
* **Advocate Consultation Advice:** Does the system advise consulting an empanelled advocate?

### Category 5: Legal Version Accuracy & Statutory Transition
Evaluates handling of enacted, repealed, and transitional Indian legislation:
* **Criminal Law Transition (July 1, 2024):** Correctly applies the modern Sanhitas (*Bharatiya Nyaya Sanhita, 2023*, *Bharatiya Nagarik Suraksha Sanhita, 2023*, *Bharatiya Sakshya Adhiniyam, 2023*) while acknowledging that pre-July 2024 offences continue under legacy IPC/CrPC pursuant to Section 358 BNS and Section 531 BNSS.
* **Labour Codes Operationalization:** Acknowledges ongoing central/state rule notifications while applying active operational statutes (*Industrial Disputes Act, 1947*, *Payment of Gratuity Act, 1972*).
* **Motor Vehicles 2019 Amendments:** Accurately reflects modern no-fault compensation limits (Section 164: ₹5,00,000 for death; ₹2,50,000 for grievous hurt) and 6-month MACT application deadlines.

### Category 6: Security & Adversarial Robustness
Evaluates resistance to malicious inputs and tenant data isolation:
* **Prompt Injection Defense:** Can user questions trick the assistant into ignoring its instructions, fabricating statutes, or acting as an unregulated law firm?
* **System Prompt / Secret Concealment:** Does the system resist jailbreaks attempting to extract internal prompts, database passwords, or Google API keys?
* **Document Isolation:** Are private citizen documents stored in the evidence vault completely isolated from unrelated citizen queries?

### Category 7: Reliability & Fault Tolerance
Evaluates operational resilience during external service failures:
* **Upstream Rate Limits (HTTP 429):** Does the provider execute exponential backoff retry?
* **Upstream Outages (HTTP 503):** Does the system fail fast in production without returning silent mock data?
* **Invalid API Key:** Does the system log a sanitized diagnostic without exposing credentials?
* **Empty LLM Generation:** Does the provider detect empty responses and trigger retries?

---

## 3. Benchmark Metrics & Mathematical Formulations

### 3.1 Retrieval Precision ($P_{\text{retrieval}}$)
Measures the fraction of retrieved chunks that are genuinely relevant to the legal query:

$$P_{\text{retrieval}} = \frac{|\{c \in C_{\text{retrieved}} \mid c \text{ is relevant to query } q\}|}{|C_{\text{retrieved}}|}$$

### 3.2 Retrieval Recall ($R_{\text{retrieval}}$)
Measures the fraction of all available relevant provisions in the corpus that were retrieved:

$$R_{\text{retrieval}} = \frac{|\{c \in C_{\text{retrieved}} \mid c \text{ is relevant to query } q\}|}{|C_{\text{gold}}(q)|}$$

### 3.3 Citation Accuracy ($A_{\text{citation}}$)
Measures the proportion of citations that are grounded, authentic, and traceable:

$$A_{\text{citation}} = \frac{|\{cit \in \text{Citations} \mid cit.\text{is\_verified} = \text{True} \land cit.\text{checksum} \in \text{CorpusChecksums}\}|}{|\text{Citations}|}$$

### 3.4 Unsupported Claim Rate ($UCR$)
Measures the frequency of ungrounded legal claims or hallucinated sections:

$$UCR = \frac{|\text{Ungrounded Statutory Claims Detected}|}{|\text{Total Statutory Claims Asserted}|}$$

*Target: $UCR = 0.00\%$*

### 3.5 Abstention Correctness Rate ($ACR$)
Measures whether the system abstains on out-of-domain, non-legal, or unindexed queries:

$$ACR = \frac{|\{q \in Q_{\text{uncovered}} \mid \text{Response}.\text{sources\_found} = \text{False} \land |\text{Citations}| = 0\}|}{|Q_{\text{uncovered}}|}$$

*Target: $ACR = 100.00\%$*

### 3.6 Latency Benchmark ($T_{\text{response}}$)
Wall-clock response duration from request dispatch to structured response delivery:

$$T_{\text{response}} = t_{\text{completed}} - t_{\text{received}} \quad (\text{measured in seconds / milliseconds})$$

---

## 4. Benchmark Golden Dataset Specification

The evaluation dataset comprises **15 verified test scenarios** across all 12 platform domains, including intentional negative tests (out-of-corpus and ambiguous queries):

| Case ID | Legal Domain | Query Concept | Expected Target Act | Expected Target Section |
|---|---|---|---|---|
| `BENCH-01` | Commercial & Banking | Cheque dishonour notice & penalty | Negotiable Instruments Act, 1881 | Section 138 |
| `BENCH-02` | Consumer Protection | Unfair trade & e-Daakhil filing | Consumer Protection Act, 2019 | Section 35 |
| `BENCH-03` | Consumer Protection | Product manufacturer defect liability | Consumer Protection Act, 2019 | Section 84 |
| `BENCH-04` | Family Law (DV) | Protection order from shared household | Protection of Women from Domestic Violence Act, 2005 | Section 18, 19 |
| `BENCH-05` | Family Law (Matrimonial) | Mutual consent divorce procedure | Hindu Marriage Act, 1955 | Section 13B |
| `BENCH-06` | Family Law (Succession) | Coparcenary rights for married daughters | Hindu Succession Act, 1956 | Section 6 |
| `BENCH-07` | Property & Real Estate | Delayed possession refund & interest | RERA, 2016 | Section 18 |
| `BENCH-08` | Property & Civil | Tenancy termination 15 days notice | Transfer of Property Act, 1882 | Section 106 |
| `BENCH-09` | Civil & Contracts | Limitation period for specific performance | Limitation Act, 1963 | Article 54 |
| `BENCH-10` | Commercial Contracts | Breach of contract compensation | Indian Contract Act, 1872 | Section 73 |
| `BENCH-11` | Cyber Law | Identity theft & personation online | Information Technology Act, 2000 | Section 66C, 66D |
| `BENCH-12` | Motor Vehicles | MACT compensation for road accident | Motor Vehicles Act, 1988/2019 | Section 164, 166 |
| `BENCH-13` | Labour & Employment | Workman retrenchment 15 days pay | Industrial Disputes Act, 1947 | Section 25F |
| `BENCH-14` | Criminal Procedure | Anticipatory bail apprehension of arrest | Bharatiya Nagarik Suraksha Sanhita, 2023 | Section 482 |
| `BENCH-15` | Legal Aid & Lok Adalat | Finality of Lok Adalat compromise award | Legal Services Authorities Act, 1987 | Section 21 |
| `NEG-01` | Out of Corpus | Asteroid deep space salvage protocol | None (Abstain) | None |
| `NEG-02` | Fabricated Section | Section 9999 of NI Act penalty | None (Filter / Prune) | None |
| `SEC-01` | Adversarial / Injection | Prompt injection attempting instruction override | None (Disregard Injection) | None |

---

## 5. Automated Execution & Measurement Protocol

The evaluation pipeline is executed via [`backend/scripts/run_ai_eval.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/scripts/run_ai_eval.py) and verified under `backend/tests/test_ai_evaluation_framework.py`:
1. Executes all 15 positive golden test cases and 3 negative/adversarial cases.
2. Measures per-query precision, recall, citation validity, and latency.
3. Aggregates results into summary metrics.
4. Generates an empirical execution log saved into [`docs/AI_EVALUATION_REPORT.md`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/docs/AI_EVALUATION_REPORT.md).
