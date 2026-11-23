# NyayaSetu (न्यायसेतु) — Legal Corpus Expansion & Ingestion Plan

**Specification Document:** Primary Source Ingestion Strategy & Domain Roadmap  
**Effective Date:** November 21, 2026  
**Target Knowledge Base:** PostgreSQL 16 · pgvector · Google GenAI (`text-embedding-004`)  
**Standard of Verification:** Official Government Gazettes · India Code · Supreme Court of India · NALSA  

---

## 1. Executive Summary & Purpose

NyayaSetu provides citizens and advocates with grounded preliminary legal assessments. The initial prototype contained only five statutes and 11 statutory sections, resulting in knowledge retrieval gaps across major areas of citizen grievance (e.g., family disputes, cyber fraud, motor vehicle accidents, employment retrenchment, and civil property contracts).

This plan outlines a **scalable, source-verified, and repeatable ingestion framework** covering **10 core legal domains**. Ingestion strictly follows authoritative primary legal sources (India Code, Official Gazette of India, NALSA, and judicial portals) to prevent hallucinated statutes or unverified legal interpretations.

---

## 2. Priority Domains & Statutory Coverage Matrix

| Domain | Priority | Current Status | Primary Authoritative Statutes | Official Primary Source |
|---|---|---|---|---|
| **1. Family Law** | **P0** | Missing | • Protection of Women from Domestic Violence Act, 2005 (PWDVA)<br>• Hindu Marriage Act, 1955 (HMA)<br>• Hindu Succession Act, 1956 (2005 Amendment)<br>• Special Marriage Act, 1954 | India Code (`indiacode.nic.in/handle/123456789/2012`) |
| **2. Criminal Law** | **P0** | Partial (BNSS 479 only) | • Bharatiya Nyaya Sanhita, 2023 (BNS)<br>• Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)<br>• Bharatiya Sakshya Adhiniyam, 2023 (BSA)<br>*(Transitional note: IPC 1860 / CrPC 1973 for pre-July 2024 matters)* | Ministry of Home Affairs / India Code (`mha.gov.in/en/acts`) |
| **3. Commercial & Contracts** | **P0** | Partial (NI Act 138 only) | • Indian Contract Act, 1872 (ICA)<br>• Negotiable Instruments Act, 1881 (NI Act)<br>• Specific Relief Act, 1963 (SRA) | India Code (`indiacode.nic.in/handle/123456789/2187`) |
| **4. Consumer Protection** | **P1** | Partial (CPA 2019 basic) | • Consumer Protection Act, 2019 (CPA)<br>• CPA (E-Commerce) Rules, 2020 | India Code (`indiacode.nic.in/handle/123456789/15256`) |
| **5. Cyber Law & Privacy** | **P1** | Missing | • Information Technology Act, 2000 (IT Act)<br>• Digital Personal Data Protection Act, 2023 (DPDP) | Ministry of Electronics and IT / Gazette of India (`meity.gov.in/acts`) |
| **6. Motor Vehicle Law** | **P1** | Missing | • Motor Vehicles Act, 1988 (as amended by MV Amendment Act, 2019) | MoRTH (`morth.nic.in/acts-rules-and-notifications`) |
| **7. Property & Civil Law** | **P1** | Partial (RERA only) | • Transfer of Property Act, 1882 (TPA)<br>• Limitation Act, 1963<br>• Real Estate (Regulation and Development) Act, 2016 (RERA) | India Code (`indiacode.nic.in/handle/123456789/2338`) |
| **8. Legal Aid & Access** | **P1** | Partial (NALSA 12, 19) | • Legal Services Authorities Act, 1987 (NALSA) | NALSA Portal (`nalsa.gov.in/acts-rules`) |
| **9. Employment & Labour** | **P2** | Missing | • Industrial Disputes Act, 1947<br>• Payment of Gratuity Act, 1972<br>• Employees' Compensation Act, 1923<br>*(Transitional note: 4 Labour Codes operationalization)* | Ministry of Labour and Employment (`labour.gov.in/acts`) |
| **10. Intellectual Property** | **P2** | Missing | • Copyright Act, 1957<br>• Trade Marks Act, 1999 | DPIIT (`ipindia.gov.in`) |

---

## 3. Statutory Status & Accuracy Rules

### 3.1 Criminal Law Transition (BNS / BNSS / BSA vs IPC / CrPC / IEA)
* **Date of Enactment:** July 1, 2024.
* **Supersession Rule:**
  * Offences committed on or after July 1, 2024, are governed by the **Bharatiya Nyaya Sanhita, 2023 (BNS)** and investigated under the **Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)** with evidence admitted under the **Bharatiya Sakshya Adhiniyam, 2023 (BSA)**.
  * Offences committed prior to July 1, 2024, remain governed by the **Indian Penal Code, 1860 (IPC)** and **Code of Criminal Procedure, 1973 (CrPC)** pursuant to Section 358 BNS and Section 531 BNSS (saving and transitional provisions).
* **System Requirement:** Both the modern Sanhitas and key legacy provisions are cross-referenced to assist citizens regardless of when the offence occurred.

### 3.2 Labour Codes Status Check
* The Parliament of India enacted four Labour Codes:
  1. *Code on Wages, 2019*
  2. *Industrial Relations Code, 2020*
  3. *Code on Social Security, 2020*
  4. *Occupational Safety, Health and Working Conditions Code, 2020*
* **Current Operational Status:** Central and State Governments are progressively harmonizing and finalizing state rules. Existing statutes (e.g., *Industrial Disputes Act, 1947*, *Payment of Gratuity Act, 1972*, *Employees' Compensation Act, 1923*) remain active and enforced in day-to-day labour court and tribunal practice.
* **System Requirement:** Ingest existing operational statutes while noting corresponding sections in the new codes.

### 3.3 Central vs State-Specific Enactments
* **Central Application:** Acts such as the Negotiable Instruments Act, Bharatiya Nyaya Sanhita, Consumer Protection Act, and Indian Contract Act apply uniformly across India.
* **State Specificity:** 
  * Tenancy and rent disputes are governed by State Rent Control Acts (e.g., *Maharashtra Rent Control Act, 1999*, *Delhi Rent Control Act, 1958*, *Karnataka Rent Act, 1999*).
  * Succession and marriage laws differ between personal laws (Hindu, Muslim, Christian, Parsi) and secular statutes (*Special Marriage Act, 1954*).
* **System Requirement:** The `jurisdiction` field must strictly tag whether an Act is `"Union of India"` (national) or specific to a State (e.g., `"State of Maharashtra"`).

---

## 4. Ingestion Workflow & Metadata Architecture

### 4.1 Required Metadata Schema
Every legal source record stored in `legal_sources` and chunked into `legal_chunks` must satisfy the following schema:

```json
{
  "title": "The Protection of Women from Domestic Violence Act, 2005",
  "short_code": "PWDVA_2005",
  "citation": "Act No. 43 of 2005",
  "act_or_judgment_identifier": "Act No. 43 of 2005",
  "source_type": "BARE_ACT",
  "jurisdiction": "Union of India",
  "court": null,
  "publication_date": "2005-09-13",
  "commencement_date": "2006-10-26",
  "last_verified_date": "2026-01-01",
  "document_version": "2026.1",
  "official_source_url": "https://www.indiacode.nic.in/handle/123456789/2012",
  "legal_domain": "Family Law",
  "content_checksum": "<SHA-256>",
  "chunks": [
    {
      "section_number": "Section 3",
      "clause_heading": "Definition of domestic violence",
      "chunk_text": "...",
      "token_count": 210,
      "embedding": [ ... 768 floats ... ]
    }
  ]
}
```

### 4.2 Ingestion Pipeline Stages
1. **Source Discovery & Verification:** Fetch primary Bare Act text exclusively from `indiacode.nic.in` or government portals. Verify repeal/amendment status.
2. **Structural Chunking:** Split by Section/Clause boundaries (`Section 12`, `Section 138`) preserving original legislative language, clause headings, and sub-sections.
3. **Cryptographic Checksumming:** Generate standard SHA-256 hash for each chunk text to ensure immutable grounding verification.
4. **Asymmetric Embedding:** Pass text to `GeminiEmbeddingProvider.embed_document(chunk_text, title=source_title)` with `task_type="RETRIEVAL_DOCUMENT"`.
5. **pgvector Storage:** Ingest into PostgreSQL `legal_chunks` table indexed by HNSW (`vector_cosine_ops`).

---

## 5. Batch 1 Scope (Managed First Ingestion)

The verified first batch expands NyayaSetu from 5 statutes (11 chunks) to **14 authoritative statutes across all 10 priority domains**:

1. **Family Law:**
   - *Protection of Women from Domestic Violence Act, 2005* (Sections 3, 12, 18, 19, 20)
   - *Hindu Marriage Act, 1955* (Sections 13, 13B, 24, 25)
   - *Hindu Succession Act, 1956* (Sections 6, 8)
2. **Criminal Law:**
   - *Bharatiya Nyaya Sanhita, 2023 (BNS)* (Sections 85, 316, 318)
   - *Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)* (Sections 173, 479, 480, 482)
   - *Bharatiya Sakshya Adhiniyam, 2023 (BSA)* (Sections 61, 63)
3. **Commercial & Contracts:**
   - *Indian Contract Act, 1872* (Sections 10, 73, 74)
   - *Negotiable Instruments Act, 1881* (Sections 138, 139, 141)
4. **Property & Civil Law:**
   - *Transfer of Property Act, 1882* (Sections 54, 106)
   - *Limitation Act, 1963* (Section 5, Articles 54, 65)
   - *Real Estate (Regulation and Development) Act, 2016* (Section 18)
5. **Consumer Protection:**
   - *Consumer Protection Act, 2019* (Sections 2(7), 35, 47, 84)
6. **Cyber Law & Data Privacy:**
   - *Information Technology Act, 2000* (Sections 43, 66C, 66D)
   - *Digital Personal Data Protection Act, 2023* (Sections 6, 11)
7. **Motor Vehicle Law:**
   - *Motor Vehicles Act, 1988* (Sections 164, 166)
8. **Employment & Labour:**
   - *Industrial Disputes Act, 1947* (Section 25F)
   - *Payment of Gratuity Act, 1972* (Section 4)
9. **Legal Aid & Lok Adalat:**
   - *Legal Services Authorities Act, 1987* (Sections 12, 19, 21)
10. **Intellectual Property:**
    - *Copyright Act, 1957* (Sections 14, 51, 52)
    - *Trade Marks Act, 1999* (Section 29)

This managed first batch ensures that NyayaSetu can answer citizen inquiries across all 10 core legal practice areas with zero hallucination and 100% source backing.
