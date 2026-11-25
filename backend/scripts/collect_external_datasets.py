#!/usr/bin/env python3
"""Phase 1 & 2: Selective External Legal Dataset Collector and Registry Builder for SATYA.

Fetches only approved raw dataset files via direct HTTPS download (no full repo clones,
no execution of external code), verifies byte integrity & readability, organizes files
into SATYA's structured data/raw/ taxonomy, and writes data/metadata/dataset_registry.{json,csv}.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from typing import Any, Dict, List
import urllib.error
import urllib.parse
import urllib.request

SATYA_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = SATYA_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
METADATA_DIR = DATA_DIR / "metadata"

CATEGORY_DIRS = [
    RAW_DIR / "central_legislation",
    RAW_DIR / "karnataka_state_legislation",
    RAW_DIR / "court_judgments" / "indian_bail_judgments_1200",
    RAW_DIR / "court_judgments" / "imljd",
    RAW_DIR / "court_judgments" / "supreme_court_pdfs",
    RAW_DIR / "legal_amendments",
    RAW_DIR / "government_notifications_and_circulars" / "gov_myscheme",
    RAW_DIR / "government_notifications_and_circulars" / "policy_reports",
    RAW_DIR / "other_legal_documents" / "it_act_2000_reference",
    RAW_DIR / "other_legal_documents" / "land_dispute_pdf",
    DATA_DIR / "processed" / "cleaned",
    DATA_DIR / "processed" / "normalized",
    DATA_DIR / "processed" / "chunked",
    METADATA_DIR,
]

# Declarative manifest of approved files to fetch
DOWNLOAD_MANIFEST: List[Dict[str, Any]] = [
    # 1. arpitgupta369/it-act-2000-reference (Non-authoritative secondary summary reference only)
    {
        "dataset_name": "it_act_2000_reference",
        "original_repo_url": "https://github.com/arpitgupta369/it-act-2000-reference",
        "source_file_url": "https://raw.githubusercontent.com/arpitgupta369/it-act-2000-reference/main/data/it_act_sections.json",
        "rel_dest": "other_legal_documents/it_act_2000_reference/it_act_sections.json",
        "original_filename": "data/it_act_sections.json",
        "file_format": "JSON",
        "legal_domain": "CYBER_LAW",
        "source_and_jurisdiction": "Secondary developer summary (Union of India - IT Act 2000 & IT Rules 2021)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-07-18",
        "license": "MIT",
        "verification_status": "SECONDARY_SUMMARY_NOT_AUTHORITATIVE",
        "legal_currency_status": "MIXED_CONTAINS_TRANSITIONING_43A",
        "ingest_to_rag": False,
        "notes": "Self-disclosed plain-language summary, not authoritative statutory text. Sec 43A subject to DPDPA 2023 Sec 44(2) transition.",
    },
    {
        "dataset_name": "it_act_2000_reference",
        "original_repo_url": "https://github.com/arpitgupta369/it-act-2000-reference",
        "source_file_url": "https://raw.githubusercontent.com/arpitgupta369/it-act-2000-reference/main/LICENSE",
        "rel_dest": "other_legal_documents/it_act_2000_reference/LICENSE",
        "original_filename": "LICENSE",
        "file_format": "TXT",
        "legal_domain": "METADATA",
        "source_and_jurisdiction": "GitHub Repo License",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-07-18",
        "license": "MIT",
        "verification_status": "LICENSE_DOCUMENT",
        "legal_currency_status": "NOT_APPLICABLE",
        "ingest_to_rag": False,
        "notes": "MIT license file.",
    },
    # 2. SnehaDeshmukh28/IndianBailJudgments-1200 (structured JSON/CSV; 298MB PDF zip skipped per plan)
    {
        "dataset_name": "IndianBailJudgments-1200",
        "original_repo_url": "https://github.com/SnehaDeshmukh28/IndianBailJudgments-1200",
        "source_file_url": "https://raw.githubusercontent.com/SnehaDeshmukh28/IndianBailJudgments-1200/main/indian_bail_judgments.json",
        "rel_dest": "court_judgments/indian_bail_judgments_1200/indian_bail_judgments.json",
        "original_filename": "indian_bail_judgments.json",
        "file_format": "JSON",
        "legal_domain": "CRIMINAL_LAW",
        "source_and_jurisdiction": "Indian Courts (78 courts, 28 regions, 1975-2025; HF mirror SnehaDeshmukh/IndianBailJudgments-1200)",
        "jurisdiction": "Union of India / Multi-State Courts",
        "publication_or_update_date": "2025-12-05",
        "license": "CC-BY-4.0",
        "verification_status": "ANNOTATED_JUDICIAL_DATASET",
        "legal_currency_status": "HISTORICAL_PRECEDENT_CITES_IPC_CRPC",
        "ingest_to_rag": True,
        "notes": "1,200 annotated bail orders. Pre-July 2024 orders cite IPC/CrPC (superseded by BNS/BNSS 2023). Contains noisy crime_type labels on some rows.",
    },
    {
        "dataset_name": "IndianBailJudgments-1200",
        "original_repo_url": "https://github.com/SnehaDeshmukh28/IndianBailJudgments-1200",
        "source_file_url": "https://raw.githubusercontent.com/SnehaDeshmukh28/IndianBailJudgments-1200/main/indian_bail_judgments.csv",
        "rel_dest": "court_judgments/indian_bail_judgments_1200/indian_bail_judgments.csv",
        "original_filename": "indian_bail_judgments.csv",
        "file_format": "CSV",
        "legal_domain": "CRIMINAL_LAW",
        "source_and_jurisdiction": "Indian Courts (78 courts, 28 regions, 1975-2025)",
        "jurisdiction": "Union of India / Multi-State Courts",
        "publication_or_update_date": "2025-12-05",
        "license": "CC-BY-4.0",
        "verification_status": "ANNOTATED_JUDICIAL_DATASET",
        "legal_currency_status": "HISTORICAL_PRECEDENT_CITES_IPC_CRPC",
        "ingest_to_rag": False,
        "notes": "Tabular companion to indian_bail_judgments.json (preserved in raw; JSON used as primary structured source to avoid duplicate chunks).",
    },
    {
        "dataset_name": "IndianBailJudgments-1200",
        "original_repo_url": "https://github.com/SnehaDeshmukh28/IndianBailJudgments-1200",
        "source_file_url": "https://raw.githubusercontent.com/SnehaDeshmukh28/IndianBailJudgments-1200/main/summarized_stats.txt",
        "rel_dest": "court_judgments/indian_bail_judgments_1200/summarized_stats.txt",
        "original_filename": "summarized_stats.txt",
        "file_format": "TXT",
        "legal_domain": "METADATA",
        "source_and_jurisdiction": "Dataset summary statistics",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2025-12-05",
        "license": "CC-BY-4.0",
        "verification_status": "METADATA_DOCUMENT",
        "legal_currency_status": "NOT_APPLICABLE",
        "ingest_to_rag": False,
        "notes": "Author-published statistical breakdown.",
    },
    {
        "dataset_name": "IndianBailJudgments-1200",
        "original_repo_url": "https://github.com/SnehaDeshmukh28/IndianBailJudgments-1200",
        "source_file_url": "https://raw.githubusercontent.com/SnehaDeshmukh28/IndianBailJudgments-1200/main/LICENSE",
        "rel_dest": "court_judgments/indian_bail_judgments_1200/LICENSE",
        "original_filename": "LICENSE",
        "file_format": "TXT",
        "legal_domain": "METADATA",
        "source_and_jurisdiction": "CC-BY-4.0 License",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2025-12-05",
        "license": "CC-BY-4.0",
        "verification_status": "LICENSE_DOCUMENT",
        "legal_currency_status": "NOT_APPLICABLE",
        "ingest_to_rag": False,
        "notes": "CC BY 4.0 license text.",
    },
    # 3. joyboseroy/imljd (Hugging Face CSV exports of GitHub/HF dataset built from AWS Open Data eCourts/SC)
    {
        "dataset_name": "IMLJD",
        "original_repo_url": "https://github.com/joyboseroy/imljd",
        "source_file_url": "https://huggingface.co/datasets/joyboseroy/imljd/resolve/main/sc_enriched.csv",
        "rel_dest": "court_judgments/imljd/sc_enriched.csv",
        "original_filename": "sc_enriched.csv",
        "file_format": "CSV",
        "legal_domain": "FAMILY_LAW",
        "source_and_jurisdiction": "Supreme Court of India (2000-2024; AWS Open Data s3://indian-supreme-court-judgments/)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-05-31",
        "license": "CC-BY-4.0 / MIT",
        "verification_status": "VERIFIED_JUDICIAL_ARCHIVE_DERIVED",
        "legal_currency_status": "HISTORICAL_PRECEDENT_CITES_IPC_CRPC",
        "ingest_to_rag": True,
        "notes": "1,474 Supreme Court matrimonial litigation cases (IPC 498A / DV Act / CrPC 482).",
    },
    {
        "dataset_name": "IMLJD",
        "original_repo_url": "https://github.com/joyboseroy/imljd",
        "source_file_url": "https://huggingface.co/datasets/joyboseroy/imljd/resolve/main/hc_karnataka.csv",
        "rel_dest": "court_judgments/imljd/hc_karnataka.csv",
        "original_filename": "hc_karnataka.csv",
        "file_format": "CSV",
        "legal_domain": "FAMILY_LAW",
        "source_and_jurisdiction": "High Court of Karnataka (2018-2024; AWS Open Data s3://indian-high-court-judgments/)",
        "jurisdiction": "Karnataka",
        "publication_or_update_date": "2026-05-31",
        "license": "CC-BY-4.0 / MIT",
        "verification_status": "VERIFIED_JUDICIAL_ARCHIVE_DERIVED",
        "legal_currency_status": "HISTORICAL_PRECEDENT_CITES_IPC_CRPC",
        "ingest_to_rag": True,
        "notes": "Karnataka HC CrPC 482 quashing petitions; metadata + eCourts pdf_link references.",
    },
    {
        "dataset_name": "IMLJD",
        "original_repo_url": "https://github.com/joyboseroy/imljd",
        "source_file_url": "https://raw.githubusercontent.com/joyboseroy/imljd/main/LICENSE",
        "rel_dest": "court_judgments/imljd/LICENSE",
        "original_filename": "LICENSE",
        "file_format": "TXT",
        "legal_domain": "METADATA",
        "source_and_jurisdiction": "GitHub MIT License",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-05-18",
        "license": "MIT",
        "verification_status": "LICENSE_DOCUMENT",
        "legal_currency_status": "NOT_APPLICABLE",
        "ingest_to_rag": False,
        "notes": "MIT license file from GitHub repo (HF card specifies CC-BY-4.0 for dataset).",
    },
    # 4. Aryan-Pardeshi/gov-myscheme-dataset
    {
        "dataset_name": "gov-myscheme-dataset",
        "original_repo_url": "https://github.com/Aryan-Pardeshi/gov-myscheme-dataset",
        "source_file_url": "https://raw.githubusercontent.com/Aryan-Pardeshi/gov-myscheme-dataset/main/gov_myscheme_data.json",
        "rel_dest": "government_notifications_and_circulars/gov_myscheme/gov_myscheme_data.json",
        "original_filename": "gov_myscheme_data.json",
        "file_format": "JSON",
        "legal_domain": "GOVERNMENT_SCHEME",
        "source_and_jurisdiction": "MyScheme Portal (myscheme.gov.in) - Central (527) & State/UT (1,539) Schemes",
        "jurisdiction": "Union of India & States/UTs",
        "publication_or_update_date": "2026-10-07",
        "license": "UNSPECIFIED_IN_GITHUB_REPO (Source: Public MyScheme Gov Portal)",
        "verification_status": "SECONDARY_MIRROR_WITH_GOV_URLS",
        "legal_currency_status": "SNAPSHOT_SUBJECT_TO_SCHEME_UPDATES",
        "ingest_to_rag": True,
        "notes": "2,066 government schemes with official MyScheme & Ministry URLs. Verify live portal before relying on eligibility/amounts.",
    },
    {
        "dataset_name": "gov-myscheme-dataset",
        "original_repo_url": "https://github.com/Aryan-Pardeshi/gov-myscheme-dataset",
        "source_file_url": "https://raw.githubusercontent.com/Aryan-Pardeshi/gov-myscheme-dataset/main/README.md",
        "rel_dest": "government_notifications_and_circulars/gov_myscheme/README.md",
        "original_filename": "README.md",
        "file_format": "TXT",
        "legal_domain": "METADATA",
        "source_and_jurisdiction": "Dataset documentation",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-10-07",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "METADATA_DOCUMENT",
        "legal_currency_status": "NOT_APPLICABLE",
        "ingest_to_rag": False,
        "notes": "Documentation only; supabase_schema.sql and extract_myscheme_data.py intentionally not fetched/executed.",
    },
    # 6. Pratik45ro/AI-Law-Chatbot/datasets (Selective primary acts, judgments, policy PDFs; opaque Law1/Law_dataset/IPC_dataset skipped)
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/constitution_of_india.pdf",
        "rel_dest": "central_legislation/constitution_of_india.pdf",
        "original_filename": "datasets/indian_constitution/constitution_of_india.pdf",
        "file_format": "PDF",
        "legal_domain": "CONSTITUTIONAL_LAW",
        "source_and_jurisdiction": "Union of India (Third-party GitHub PDF; requires official IndiaCode verification)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_VERIFY_AMENDMENTS",
        "ingest_to_rag": True,
        "notes": "Constitution of India PDF; verify amendment cut-off date.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/bharatiya_nyay_sanhita_2023.pdf",
        "rel_dest": "central_legislation/bharatiya_nyay_sanhita_2023.pdf",
        "original_filename": "datasets/indian_constitution/bharatiya_nyay_sanhita_2023.pdf",
        "file_format": "PDF",
        "legal_domain": "CRIMINAL_LAW",
        "source_and_jurisdiction": "Union of India (Bharatiya Nyaya Sanhita, 2023)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_ENACTED_2023_EFFECTIVE_2024_07_01",
        "ingest_to_rag": True,
        "notes": "Replaces IPC 1860 w.e.f. 2024-07-01.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/contract_act_1872.pdf",
        "rel_dest": "central_legislation/contract_act_1872.pdf",
        "original_filename": "datasets/indian_constitution/contract_act_1872.pdf",
        "file_format": "PDF",
        "legal_domain": "COMMERCIAL_AND_BANKING",
        "source_and_jurisdiction": "Union of India (Indian Contract Act, 1872)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_VERIFY_AMENDMENTS",
        "ingest_to_rag": True,
        "notes": "Full Act PDF candidate; inspect text extraction quality.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/citizenship_act_1955.pdf",
        "rel_dest": "central_legislation/citizenship_act_1955.pdf",
        "original_filename": "datasets/indian_constitution/citizenship_act_1955.pdf",
        "file_format": "PDF",
        "legal_domain": "CONSTITUTIONAL_LAW",
        "source_and_jurisdiction": "Union of India (Citizenship Act, 1955)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_VERIFY_AMENDMENTS",
        "ingest_to_rag": True,
        "notes": "Verify CAA 2019 amendments.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/epidemic_diseases_act_1897.pdf",
        "rel_dest": "central_legislation/epidemic_diseases_act_1897.pdf",
        "original_filename": "datasets/indian_constitution/epidemic_diseases_act_1897.pdf",
        "file_format": "PDF",
        "legal_domain": "PUBLIC_HEALTH_LAW",
        "source_and_jurisdiction": "Union of India (Epidemic Diseases Act, 1897)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_VERIFY_AMENDMENTS",
        "ingest_to_rag": True,
        "notes": "Verify 2020 Amendment inclusion.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/information_technology_rules_2021.pdf",
        "rel_dest": "central_legislation/information_technology_rules_2021.pdf",
        "original_filename": "datasets/indian_constitution/information_technology_rules_2021.pdf",
        "file_format": "PDF",
        "legal_domain": "CYBER_LAW",
        "source_and_jurisdiction": "Union of India (IT Intermediary Guidelines and Digital Media Ethics Code Rules, 2021)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "AMENDED_2023_VERIFY_LATEST",
        "ingest_to_rag": True,
        "notes": "Check if 2023 amendments / Bombay HC Kunal Kamra rulings affect Rule 3(1)(b)(v).",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/prevention_cruelty_animals_1960.pdf",
        "rel_dest": "central_legislation/prevention_cruelty_animals_1960.pdf",
        "original_filename": "datasets/indian_constitution/prevention_cruelty_animals_1960.pdf",
        "file_format": "PDF",
        "legal_domain": "ANIMAL_AND_ENV_LAW",
        "source_and_jurisdiction": "Union of India (Prevention of Cruelty to Animals Act, 1960)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_VERIFY_AMENDMENTS",
        "ingest_to_rag": True,
        "notes": "Central legislation PDF.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/indian_penal_code_1860.pdf",
        "rel_dest": "central_legislation/indian_penal_code_1860_SUPERSEDED.pdf",
        "original_filename": "datasets/indian_constitution/indian_penal_code_1860.pdf",
        "file_format": "PDF",
        "legal_domain": "CRIMINAL_LAW",
        "source_and_jurisdiction": "Union of India (Indian Penal Code, 1860 - Repealed/Replaced by BNS 2023)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "REPEALED_SUPERSEDED_BY_BNS_2023",
        "ingest_to_rag": True,
        "notes": "REPEALED w.e.f. 2024-07-01 by Bharatiya Nyaya Sanhita, 2023 (remains applicable only to pre-1 July 2024 offences).",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/wealth_tax_act_1957.pdf",
        "rel_dest": "central_legislation/wealth_tax_act_1957_ABOLISHED.pdf",
        "original_filename": "datasets/indian_constitution/wealth_tax_act_1957.pdf",
        "file_format": "PDF",
        "legal_domain": "TAX_LAW",
        "source_and_jurisdiction": "Union of India (Wealth-tax Act, 1957 - Abolished via Finance Act, 2015)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "REPEALED_ABOLISHED_FINANCE_ACT_2015",
        "ingest_to_rag": True,
        "notes": "ABOLISHED w.e.f. AY 2016-17 by Finance Act, 2015. Must never be presented as active tax liability.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/property_and_land/MV%20Act%20English.pdf",
        "rel_dest": "central_legislation/mv_act_english.pdf",
        "original_filename": "datasets/property_and_land/MV Act English.pdf",
        "file_format": "PDF",
        "legal_domain": "MOTOR_VEHICLES",
        "source_and_jurisdiction": "Union of India (Motor Vehicles Act, 1988)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "VERIFY_2019_AMENDMENTS",
        "ingest_to_rag": True,
        "notes": "Verify inclusion of Motor Vehicles (Amendment) Act, 2019.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/traffic_laws/cmvr-1989.pdf",
        "rel_dest": "central_legislation/cmvr_1989.pdf",
        "original_filename": "datasets/traffic_laws/cmvr-1989.pdf",
        "file_format": "PDF",
        "legal_domain": "MOTOR_VEHICLES",
        "source_and_jurisdiction": "Union of India (Central Motor Vehicles Rules, 1989)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "VERIFY_AMENDMENTS",
        "ingest_to_rag": True,
        "notes": "Central Motor Vehicles Rules, 1989.",
    },
    # Judgments from AI-Law-Chatbot
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/kesavananda_bharati.pdf",
        "rel_dest": "court_judgments/supreme_court_pdfs/kesavananda_bharati.pdf",
        "original_filename": "datasets/indian_constitution/kesavananda_bharati.pdf",
        "file_format": "PDF",
        "legal_domain": "CONSTITUTIONAL_LAW",
        "source_and_jurisdiction": "Supreme Court of India (Kesavananda Bharati v. State of Kerala, 1973)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "1973-04-24",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "LANDMARK_PRECEDENT",
        "ingest_to_rag": True,
        "notes": "Basic Structure Doctrine landmark judgment.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/pathapati_subba_reddy.pdf",
        "rel_dest": "court_judgments/supreme_court_pdfs/pathapati_subba_reddy.pdf",
        "original_filename": "datasets/indian_constitution/pathapati_subba_reddy.pdf",
        "file_format": "PDF",
        "legal_domain": "PROPERTY_AND_CIVIL",
        "source_and_jurisdiction": "Supreme Court of India (Pathapati Subba Reddy v. Special Deputy Collector, 2024)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2024-04-08",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_PRECEDENT",
        "ingest_to_rag": True,
        "notes": "Limitation Act Section 5 condonation of delay precedent.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/arbitral_tribunal_2025.pdf",
        "rel_dest": "court_judgments/supreme_court_pdfs/arbitral_tribunal_2025.pdf",
        "original_filename": "datasets/indian_constitution/arbitral_tribunal_2025.pdf",
        "file_format": "PDF",
        "legal_domain": "COMMERCIAL_AND_BANKING",
        "source_and_jurisdiction": "Indian Court / Tribunal Order (2025)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2025",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_PRECEDENT",
        "ingest_to_rag": True,
        "notes": "Arbitral tribunal judgment PDF.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/civil_appeal_property_2025.pdf",
        "rel_dest": "court_judgments/supreme_court_pdfs/civil_appeal_property_2025.pdf",
        "original_filename": "datasets/indian_constitution/civil_appeal_property_2025.pdf",
        "file_format": "PDF",
        "legal_domain": "PROPERTY_AND_CIVIL",
        "source_and_jurisdiction": "Supreme Court of India (Civil Appeal Property, 2025)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2025",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_PRECEDENT",
        "ingest_to_rag": True,
        "notes": "Civil appeal property judgment PDF.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/criminal_appeal_297_2024.pdf",
        "rel_dest": "court_judgments/supreme_court_pdfs/criminal_appeal_297_2024.pdf",
        "original_filename": "datasets/indian_constitution/criminal_appeal_297_2024.pdf",
        "file_format": "PDF",
        "legal_domain": "CRIMINAL_LAW",
        "source_and_jurisdiction": "Supreme Court of India (Criminal Appeal 297/2024)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2024",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_PRECEDENT",
        "ingest_to_rag": True,
        "notes": "Criminal Appeal 297 of 2024 judgment PDF.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/indian_constitution/supreme_court_sangram_suryavanshi.pdf",
        "rel_dest": "court_judgments/supreme_court_pdfs/supreme_court_sangram_suryavanshi.pdf",
        "original_filename": "datasets/indian_constitution/supreme_court_sangram_suryavanshi.pdf",
        "file_format": "PDF",
        "legal_domain": "CRIMINAL_LAW",
        "source_and_jurisdiction": "Supreme Court of India (Sangram Sadashiv Suryavanshi)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2024",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "CURRENT_PRECEDENT",
        "ingest_to_rag": True,
        "notes": "Supreme Court judgment PDF.",
    },
    # Policy / Regional / Other PDFs from AI-Law-Chatbot
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/property_and_land/national_rehalibaltion_policy.pdf",
        "rel_dest": "government_notifications_and_circulars/policy_reports/national_rehabilitation_policy.pdf",
        "original_filename": "datasets/property_and_land/national_rehalibaltion_policy.pdf",
        "file_format": "PDF",
        "legal_domain": "PROPERTY_AND_CIVIL",
        "source_and_jurisdiction": "Union of India (National Rehabilitation and Resettlement Policy)",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2007",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "VERIFY_LARR_2013_SUPERSESSION",
        "ingest_to_rag": True,
        "notes": "Note: RFCTLARR Act, 2013 superseded several 2007 R&R policy provisions.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/property_and_land/Land-Rights-Report-Final.pdf",
        "rel_dest": "government_notifications_and_circulars/policy_reports/land_rights_report_final.pdf",
        "original_filename": "datasets/property_and_land/Land-Rights-Report-Final.pdf",
        "file_format": "PDF",
        "legal_domain": "PROPERTY_AND_CIVIL",
        "source_and_jurisdiction": "India Land Rights Policy Report",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "SECONDARY_REPORT_NOT_STATUTE",
        "legal_currency_status": "SECONDARY_POLICY_REPORT",
        "ingest_to_rag": True,
        "notes": "Policy report, not binding legislation.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/traffic_laws/mumbai.pdf",
        "rel_dest": "government_notifications_and_circulars/policy_reports/mumbai_traffic.pdf",
        "original_filename": "datasets/traffic_laws/mumbai.pdf",
        "file_format": "PDF",
        "legal_domain": "MOTOR_VEHICLES",
        "source_and_jurisdiction": "Maharashtra / Mumbai Traffic Enforcement",
        "jurisdiction": "Maharashtra",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "VERIFY_CURRENT_FINES",
        "ingest_to_rag": True,
        "notes": "Regional Mumbai traffic notification/document.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/traffic_laws/mumbai_traffic_fines.pdf",
        "rel_dest": "government_notifications_and_circulars/policy_reports/mumbai_traffic_fines.pdf",
        "original_filename": "datasets/traffic_laws/mumbai_traffic_fines.pdf",
        "file_format": "PDF",
        "legal_domain": "MOTOR_VEHICLES",
        "source_and_jurisdiction": "Maharashtra / Mumbai Traffic Fines",
        "jurisdiction": "Maharashtra",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "VERIFY_CURRENT_FINES",
        "ingest_to_rag": True,
        "notes": "Mumbai traffic fine schedule PDF.",
    },
    {
        "dataset_name": "AI-Law-Chatbot-Datasets",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "source_file_url": "https://raw.githubusercontent.com/Pratik45ro/AI-Law-Chatbot/main/datasets/property_and_land/land_dispute.pdf",
        "rel_dest": "other_legal_documents/land_dispute_pdf/land_dispute.pdf",
        "original_filename": "datasets/property_and_land/land_dispute.pdf",
        "file_format": "PDF",
        "legal_domain": "PROPERTY_AND_CIVIL",
        "source_and_jurisdiction": "India Land Dispute Document",
        "jurisdiction": "Union of India",
        "publication_or_update_date": "2026-06-13",
        "license": "UNSPECIFIED_IN_GITHUB_REPO",
        "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
        "legal_currency_status": "UNVERIFIED_DOCUMENT",
        "ingest_to_rag": True,
        "notes": "Inspect content during preprocessing to verify provenance.",
    },
]

EXCLUDED_SOURCES = [
    {
        "dataset_name": "varma007ut/Indian_Law_Dataset",
        "original_repo_url": "https://huggingface.co/datasets/varma007ut/Indian_Law_Dataset",
        "reason": "REJECTED: Dataset contains 1,000 rows of empty strings (4,000 bytes total, 715 bytes download).",
        "processing_status": "SKIPPED_CORRUPTED_EMPTY",
    },
    {
        "dataset_name": "IndianBailJudgments-1200_PDFS.zip",
        "original_repo_url": "https://github.com/SnehaDeshmukh28/IndianBailJudgments-1200",
        "reason": "SKIPPED_LARGE_BINARY: 297.95 MB Git LFS archive skipped; structured JSON/CSV retained.",
        "processing_status": "SKIPPED_PER_APPROVAL",
    },
    {
        "dataset_name": "AI-Law-Chatbot opaque compilations (Law1.pdf, Law_dataset.pdf, IPC_dataset.pdf)",
        "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
        "reason": "EXCLUDED_UNVERIFIED_OPAQUE_COMPILATIONS: Unknown provenance, unattributed compilation PDFs.",
        "processing_status": "SKIPPED_UNVERIFIED_OPAQUE",
    },
]


def ensure_directories() -> None:
    for d in CATEGORY_DIRS:
        d.mkdir(parents=True, exist_ok=True)


def write_statutory_reference_manifests() -> None:
    """Create explicit documentation/manifests for Karnataka gap and legal amendments."""
    ka_readme = RAW_DIR / "karnataka_state_legislation" / "README.md"
    if not ka_readme.exists():
        ka_readme.write_text(
            "# Karnataka State Legislation\n\n"
            "None of the 6 inspected external repositories contained primary Karnataka State Bare Acts.\n"
            "Karnataka-specific legal materials collected from the approved datasets reside in:\n"
            "- `data/raw/court_judgments/imljd/hc_karnataka.csv` (High Court of Karnataka CrPC 482 petitions, 2018-2024)\n"
            "- `data/raw/government_notifications_and_circulars/gov_myscheme/gov_myscheme_data.json` (Karnataka state welfare schemes)\n\n"
            "Official Karnataka state statutes must be sourced from `indiacode.nic.in` (Karnataka State repository) or `dpal.karnataka.gov.in`.\n",
            encoding="utf-8",
        )

    supersession_path = RAW_DIR / "legal_amendments" / "statutory_supersession_map.json"
    if not supersession_path.exists():
        supersession_data = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "note": "Verified Indian statutory transitions & repeals used to tag historical judgments and older datasets.",
            "transitions": [
                {
                    "repealed_act": "Indian Penal Code, 1860 (IPC)",
                    "repealed_short_code": "IPC_1860",
                    "replaced_by": "Bharatiya Nyaya Sanhita, 2023 (BNS)",
                    "replaced_short_code": "BNS_2023",
                    "effective_date": "2024-07-01",
                    "status": "REPEALED_FOR_NEW_OFFENCES",
                    "notes": "IPC 1860 continues to govern offences committed prior to 1 July 2024.",
                },
                {
                    "repealed_act": "Code of Criminal Procedure, 1973 (CrPC)",
                    "repealed_short_code": "CrPC_1973",
                    "replaced_by": "Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)",
                    "replaced_short_code": "BNSS_2023",
                    "effective_date": "2024-07-01",
                    "status": "REPEALED_FOR_NEW_PROCEEDINGS",
                    "notes": "CrPC 1973 Section 482 inherent powers correspond to BNSS 2023 Section 528.",
                },
                {
                    "repealed_act": "Indian Evidence Act, 1872 (IEA)",
                    "repealed_short_code": "IEA_1872",
                    "replaced_by": "Bharatiya Sakshya Adhiniyam, 2023 (BSA)",
                    "replaced_short_code": "BSA_2023",
                    "effective_date": "2024-07-01",
                    "status": "REPEALED_FOR_NEW_PROCEEDINGS",
                    "notes": "Replaced by BSA 2023 w.e.f. 1 July 2024.",
                },
                {
                    "repealed_act": "Wealth-tax Act, 1957",
                    "repealed_short_code": "WEALTH_TAX_1957",
                    "replaced_by": None,
                    "replaced_short_code": None,
                    "effective_date": "2016-04-01",
                    "status": "ABOLISHED",
                    "notes": "Abolished by Finance Act, 2015 w.e.f. Assessment Year 2016-17.",
                },
                {
                    "repealed_act": "Information Technology Act, 2000 - Section 43A",
                    "repealed_short_code": "IT_ACT_2000_S43A",
                    "replaced_by": "Digital Personal Data Protection Act, 2023 (Section 44(2) omission)",
                    "replaced_short_code": "DPDPA_2023",
                    "effective_date": "Subject to Central Govt enforcement notification",
                    "status": "TRANSITIONING_OMISSION",
                    "notes": "DPDPA 2023 Section 44(2) omits Section 43A IT Act upon commencement notification.",
                },
            ],
        }
        supersession_path.write_text(json.dumps(supersession_data, indent=2), encoding="utf-8")


def download_file(url: str, dest: Path) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "SATYA-Dataset-Collector/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return data


def check_readability(dest: Path, fmt: str) -> str:
    try:
        data = dest.read_bytes()
        if not data:
            return "EMPTY_FILE"
        if fmt == "JSON":
            obj = json.loads(data.decode("utf-8"))
            if isinstance(obj, list):
                return f"OK_JSON_LIST({len(obj)} items)"
            if isinstance(obj, dict):
                return f"OK_JSON_DICT({len(obj)} keys)"
            return "OK_JSON"
        if fmt == "CSV":
            text = data.decode("utf-8", errors="replace")
            rows = sum(1 for _ in csv.reader(text.splitlines()))
            return f"OK_CSV({rows} rows)"
        if fmt == "PDF":
            if data[:5] != b"%PDF-":
                return "INVALID_PDF_HEADER"
            try:
                from pypdf import PdfReader
                import io
                reader = PdfReader(io.BytesIO(data))
                return f"OK_PDF({len(reader.pages)} pages)"
            except Exception as e:
                return f"PDF_HEADER_OK_PYPDF_UNAVAILABLE_OR_ERR({type(e).__name__})"
        if fmt == "TXT":
            text = data.decode("utf-8", errors="replace")
            return f"OK_TXT({len(text)} chars)"
        return "OK"
    except Exception as exc:
        return f"ERROR({type(exc).__name__}: {exc})"


def main() -> int:
    ensure_directories()
    write_statutory_reference_manifests()

    download_ts = datetime.now(timezone.utc).isoformat()
    registry_entries: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []

    for item in DOWNLOAD_MANIFEST:
        dest = RAW_DIR / item["rel_dest"]
        url = item["source_file_url"]
        print(f"[FETCH] {item['dataset_name']} -> {item['rel_dest']} ...", end=" ", flush=True)
        try:
            if dest.exists() and dest.stat().st_size > 0:
                raw_bytes = dest.read_bytes()
                status = "CACHED_LOCAL"
            else:
                raw_bytes = download_file(url, dest)
                status = "DOWNLOADED"

            sha256 = hashlib.sha256(raw_bytes).hexdigest()
            readability = check_readability(dest, item["file_format"])
            print(f"{status} ({len(raw_bytes)} bytes, {readability})")

            registry_entries.append({
                "dataset_name": item["dataset_name"],
                "original_repo_url": item["original_repo_url"],
                "source_file_url": url,
                "original_filename": item["original_filename"],
                "local_path": str(dest.relative_to(SATYA_ROOT)).replace("\\", "/"),
                "file_format": item["file_format"],
                "size_bytes": len(raw_bytes),
                "sha256": sha256,
                "legal_domain": item["legal_domain"],
                "source_and_jurisdiction": item["source_and_jurisdiction"],
                "jurisdiction": item["jurisdiction"],
                "publication_or_update_date": item["publication_or_update_date"],
                "license": item["license"],
                "download_date": download_ts,
                "verification_status": item["verification_status"],
                "legal_currency_status": item["legal_currency_status"],
                "ingest_to_rag": item["ingest_to_rag"],
                "readability_check": readability,
                "processing_status": status,
                "notes": item["notes"],
            })
        except Exception as exc:
            print(f"FAILED: {exc}")
            errors.append({"url": url, "dest": str(dest), "error": str(exc)})
            registry_entries.append({
                "dataset_name": item["dataset_name"],
                "original_repo_url": item["original_repo_url"],
                "source_file_url": url,
                "original_filename": item["original_filename"],
                "local_path": str(dest.relative_to(SATYA_ROOT)).replace("\\", "/"),
                "file_format": item["file_format"],
                "size_bytes": 0,
                "sha256": None,
                "legal_domain": item["legal_domain"],
                "source_and_jurisdiction": item["source_and_jurisdiction"],
                "jurisdiction": item["jurisdiction"],
                "publication_or_update_date": item["publication_or_update_date"],
                "license": item["license"],
                "download_date": download_ts,
                "verification_status": item["verification_status"],
                "legal_currency_status": item["legal_currency_status"],
                "ingest_to_rag": False,
                "readability_check": f"DOWNLOAD_ERROR: {exc}",
                "processing_status": "DOWNLOAD_FAILED",
                "notes": item["notes"],
            })

    registry_payload = {
        "registry_version": "1.0.0",
        "generated_at": download_ts,
        "total_repositories_inspected": 6,
        "total_files_downloaded": sum(1 for e in registry_entries if e["processing_status"] in ("DOWNLOADED", "CACHED_LOCAL")),
        "total_download_errors": len(errors),
        "downloaded_files": registry_entries,
        "excluded_sources": EXCLUDED_SOURCES,
    }

    (METADATA_DIR / "dataset_registry.json").write_text(json.dumps(registry_payload, indent=2), encoding="utf-8")

    csv_fields = [
        "dataset_name", "original_repo_url", "source_file_url", "original_filename",
        "local_path", "file_format", "size_bytes", "sha256", "legal_domain",
        "jurisdiction", "publication_or_update_date", "license", "download_date",
        "verification_status", "legal_currency_status", "ingest_to_rag",
        "readability_check", "processing_status", "notes",
    ]
    with (METADATA_DIR / "dataset_registry.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(registry_entries)

    print(f"\nRegistry written to {METADATA_DIR / 'dataset_registry.json'} and .csv")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
