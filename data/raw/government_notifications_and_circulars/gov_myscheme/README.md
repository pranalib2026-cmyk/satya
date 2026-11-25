# Indian Government MyScheme Dataset

A structured, cleaned, and enriched dataset of **2,066 Indian Government Schemes** extracted and processed from the [MyScheme Portal](https://www.myscheme.gov.in) and the [shrijayan/gov_myscheme](https://huggingface.co/datasets/shrijayan/gov_myscheme) Hugging Face repository.

---

## 📊 Dataset Overview

- **Total Schemes**: `2,066`
- **Central Government Schemes**: `527`
- **State & UT Schemes**: `1,539`
- **Formats Available**: CSV (`gov_myscheme_data.csv`), JSON (`gov_myscheme_data.json`), & Supabase / PostgreSQL (`supabase_schema.sql`)
- **Data Completeness**: 100% across all 16 attributes

---

## 📋 Schema Attributes (16 Columns)

| Column | Description | Example |
|:---|:---|:---|
| **`Scheme Name`** | Full official title of the scheme | Pradhan Mantri Kisan Samman Nidhi |
| **`Scheme Slug`** | Unique URL identifier / slug | `pm-kisan` |
| **`Level`** | `Central Government` or `State / UT Government` | `Central Government` |
| **`State / UT / Ministry`** | Nodal State, UT, or Central Ministry | `Ministry of Agriculture and Farmers Welfare` |
| **`Application Mode`** | Application channel: `Online`, `Offline`, `Online & Offline` | `Online` |
| **`Tags / Categories`** | Target groups, sectors, and keywords | `Agriculture, Farmers, Income Support, DBT` |
| **`Description`** | Comprehensive background, overview, and objectives | Details on the scheme scope and targets... |
| **`Eligibility Criteria`** | Combined full eligibility rules and conditions | Complete eligibility and exclusion text... |
| **`Eligibility (General)`** | Positive qualification rules (age, income, residency, etc.) | All landholding farmers' families... |
| **`Exclusions / Ineligibility`** | Explicit exclusions (who cannot apply) | Institutional land holders, income tax payees... |
| **`Benefits`** | Subsidies, pensions, cash awards, or financial assistance | ₹6,000 per annum in 3 equal installments... |
| **`Application Process`** | Step-by-step instructions for online/offline application | Mode: Online\nStep 1: Open portal... |
| **`Documents Required`** | Checklist of mandatory documents | Aadhaar card, landholding papers, bank passbook... |
| **`Frequently Asked Questions (FAQs)`** | Structured Q&A from official documentation | Q: Who is eligible?\nA: All farmers... |
| **`Official Link`** | Direct application portal or official ministry website | `https://pmkisan.gov.in/` |
| **`MyScheme URL`** | Canonical MyScheme webpage link | `https://www.myscheme.gov.in/schemes/pm-kisan` |

---

## ⚡ Supabase & PostgreSQL Setup

### Initialize Database & Schema
Run the provided [`supabase_schema.sql`](supabase_schema.sql) in your **Supabase SQL Editor** (or PostgreSQL instance):

The schema comes pre-configured with:
- **`pgvector` AI Embeddings**: Built-in `embedding vector(1536)` and HNSW cosine index for semantic vector search / RAG chatbots.
- **Full-Text Search (FTS)**: Built-in `tsvector` with weighted ranking (Scheme Name `A`, Tags `B`, Description `C`, Benefits `D`).
- **GIN & Trigram Indexes**: Optimized for array tag filtering (`tags @> ARRAY['Farmers']`) and typo-tolerant search (`pg_trgm`).
- **Row Level Security (RLS)**: Public read-only policy for `anon` and `authenticated` web/mobile apps.
- **5 Custom RPC Functions**: Ready-to-call stored procedures for Full-Text search, vector similarity search, and hybrid retrieval.

---

## 🚀 Quick Start in Python

```python
import pandas as pd

# Load CSV
df = pd.read_csv("gov_myscheme_data.csv")
print(f"Total schemes loaded: {len(df)}")

# Filter Central Government agricultural schemes
agri_schemes = df[
    (df["Level"] == "Central Government") & 
    (df["Tags / Categories"].str.contains("Agriculture|Farmers", case=False, na=False))
]
print(f"Central Agricultural Schemes: {len(agri_schemes)}")

# Search for student scholarships
scholarships = df[df["Scheme Name"].str.contains("Scholarship", case=False, na=False)]
print(f"Scholarship Schemes: {len(scholarships)}")
```

---

## 🛠️ Extraction Pipeline

To re-extract or update the dataset directly from the source PDFs:

```bash
python extract_myscheme_data.py
```

---

## 📜 License & Attribution

- **Data Source**: Indian Government [MyScheme Portal](https://www.myscheme.gov.in) via [shrijayan/gov_myscheme](https://huggingface.co/datasets/shrijayan/gov_myscheme).
- **License**: Apache-2.0
