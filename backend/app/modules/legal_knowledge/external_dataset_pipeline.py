"""Reusable Preprocessing & RAG Preparation Pipeline for External Indian Legal Datasets.

Handles Phase 3 (cleaning, normalization, deduplication, corruption detection) and
Phase 4 (structure-aware legal chunking with full citation & provenance traceability).
Never mutates original raw dataset files.
"""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.modules.legal_knowledge.document_parser import DocumentParser
from app.modules.legal_knowledge.legal_chunker import LegalChunker, ParsedLegalChunk


@dataclass
class NormalizedLegalDocument:
    """Canonical intermediate legal document record prior to chunking."""

    document_id: str
    source_dataset: str
    source_type: str  # BARE_ACT | COURT_JUDGMENT | GOVERNMENT_SCHEME | LEGAL_AID_SCHEME | POLICY_REPORT
    title: str
    short_code: Optional[str]
    citation: Optional[str]
    act_or_judgment_identifier: Optional[str]
    jurisdiction: str
    court: Optional[str]
    publication_date: Optional[str]
    year: Optional[int]
    document_version: str
    official_source_url: Optional[str]
    original_repo_url: str
    original_file: str
    local_raw_path: str
    license: str
    verification_status: str
    legal_currency_status: str
    amendment_notes: Optional[str]
    raw_text: str
    content_checksum: str
    structured_payload: Optional[Dict[str, Any]] = None


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def extract_pdf_safe(pdf_path: Path) -> Tuple[str, Dict[str, Any]]:
    """Extract text from PDF safely, detecting malformed headers or image-only PDFs."""
    from pypdf import PdfReader

    raw_bytes = pdf_path.read_bytes()
    header_idx = raw_bytes.find(b"%PDF-")
    malformed_header = False
    if header_idx == -1:
        return "", {"status": "CORRUPTED_NO_PDF_HEADER", "pages": 0, "extracted_chars": 0}
    if header_idx > 0:
        malformed_header = True
        raw_bytes = raw_bytes[header_idx:]

    try:
        reader = PdfReader(io.BytesIO(raw_bytes))
    except Exception as exc:
        return "", {"status": f"CORRUPTED_UNREADABLE({type(exc).__name__})", "pages": 0, "extracted_chars": 0}

    pages_text: List[str] = []
    page_errors = 0
    for page in reader.pages:
        try:
            raw_p = page.extract_text() or ""
            cleaned_p = DocumentParser._strip_gazette_headers_and_footers(raw_p)
            if cleaned_p.strip():
                pages_text.append(cleaned_p)
        except Exception:
            page_errors += 1

    joined = DocumentParser.clean_legal_text("\n\n".join(pages_text))
    page_count = len(reader.pages)
    if len(joined.strip()) < 80:
        status = "SCANNED_OR_EMPTY_TEXT_LAYER"
    elif malformed_header:
        status = "RECOVERED_MALFORMED_PREFIX"
    else:
        status = "OK"

    return joined, {
        "status": status,
        "pages": page_count,
        "page_errors": page_errors,
        "extracted_chars": len(joined),
        "malformed_header_prefix_bytes": header_idx if malformed_header else 0,
    }


def _detect_ipc_crpc_warning(text_or_sections: str) -> Optional[str]:
    low = text_or_sections.lower()
    notes: List[str] = []
    if re.search(r"\bipc\b|indian penal code", low):
        notes.append("References IPC 1860 (replaced by Bharatiya Nyaya Sanhita, 2023 w.e.f. 2024-07-01 for new offences).")
    if re.search(r"\bcrpc\b|cr\.p\.c\.|code of criminal procedure", low):
        notes.append("References CrPC 1973 (replaced by Bharatiya Nagarik Suraksha Sanhita, 2023 w.e.f. 2024-07-01).")
    return " ".join(notes) if notes else None


def preprocess_all_datasets(satya_root: Path) -> Dict[str, Any]:
    """Run Phase 3 & 4 preprocessing across all registered datasets under satya_root/data."""
    data_dir = satya_root / "data"
    metadata_dir = data_dir / "metadata"
    cleaned_dir = data_dir / "processed" / "cleaned"
    normalized_dir = data_dir / "processed" / "normalized"
    chunked_dir = data_dir / "processed" / "chunked"

    for d in (cleaned_dir, normalized_dir, chunked_dir, metadata_dir):
        d.mkdir(parents=True, exist_ok=True)

    registry_path = metadata_dir / "dataset_registry.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8"))

    audit: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_repositories_inspected": registry.get("total_repositories_inspected", 6),
        "total_files_in_registry": len(registry.get("downloaded_files", [])),
        "pdf_inspection_results": [],
        "duplicates_removed": 0,
        "corrupted_or_incomplete_records": [],
        "outdated_or_superseded_records": 0,
        "unverified_records": 0,
        "dataset_counts": {},
        "processing_errors": [],
    }

    normalized_docs: List[NormalizedLegalDocument] = []
    seen_doc_checksums: set[str] = set()

    # ── 1. Process IndianBailJudgments-1200 JSON ─────────────────────────────
    bail_entry = next(
        (e for e in registry["downloaded_files"] if e["dataset_name"] == "IndianBailJudgments-1200" and e["file_format"] == "JSON"),
        None,
    )
    if bail_entry:
        bail_path = satya_root / bail_entry["local_path"]
        bail_records = json.loads(bail_path.read_text(encoding="utf-8"))
        bail_cleaned: List[Dict[str, Any]] = []
        bail_seen_keys: set[str] = set()
        bail_dupes = 0
        bail_incomplete = 0

        for rec in bail_records:
            case_id = str(rec.get("case_id") or "").strip()
            case_title = (rec.get("case_title") or "").strip()
            court = (rec.get("court") or "Indian Court").strip()
            date_str = (rec.get("date") or "").strip()
            facts = (rec.get("facts") or "").strip()
            reason = (rec.get("judgment_reason") or "").strip()
            summary = (rec.get("summary") or "").strip()

            if not case_title or (not facts and not reason and not summary):
                bail_incomplete += 1
                audit["corrupted_or_incomplete_records"].append({
                    "dataset": "IndianBailJudgments-1200",
                    "record_id": case_id,
                    "reason": "Missing case_title or substantive text",
                })
                continue

            dedup_key = f"{case_title.lower()}|{court.lower()}|{date_str}"
            if dedup_key in bail_seen_keys:
                bail_dupes += 1
                continue
            bail_seen_keys.add(dedup_key)

            ipc_secs = rec.get("ipc_sections") or []
            ipc_label = ", ".join(f"Section {s} IPC" for s in ipc_secs) if ipc_secs else "Not specified"
            issues = rec.get("legal_issues") or []
            principles = rec.get("legal_principles_discussed") or []

            body_sections = [
                f"Case Title: {case_title}",
                f"Court: {court} | Date: {date_str or 'Unknown'} | Region: {rec.get('region') or 'Unknown'} | Judge: {rec.get('judge') or 'Unknown'}",
                f"Bail Type: {rec.get('bail_type') or 'Unknown'} | Outcome: {rec.get('bail_outcome') or 'Unknown'} ({rec.get('bail_outcome_label_detailed') or ''})",
                f"Statutes / IPC Sections Invoked: {ipc_label}",
                f"Facts:\n{facts}" if facts else "",
                ("Legal Issues:\n- " + "\n- ".join(issues)) if issues else "",
                f"Judgment Reasoning:\n{reason}" if reason else "",
                ("Legal Principles Discussed:\n- " + "\n- ".join(principles)) if principles else "",
                f"Summary:\n{summary}" if summary else "",
            ]
            clean_text = DocumentParser.clean_legal_text("\n\n".join(p for p in body_sections if p))
            checksum = sha256_text(clean_text)
            if checksum in seen_doc_checksums:
                bail_dupes += 1
                continue
            seen_doc_checksums.add(checksum)

            year = int(date_str[:4]) if len(date_str) >= 4 and date_str[:4].isdigit() else None
            is_pre_bns = (date_str < "2024-07-01") if len(date_str) >= 10 else True
            amendment_note = (
                "Historical bail order citing IPC/CrPC; for offences committed on or after 1 July 2024, verify corresponding BNS 2023 / BNSS 2023 provisions."
                if (ipc_secs or is_pre_bns)
                else None
            )
            if amendment_note:
                audit["outdated_or_superseded_records"] += 1
            audit["unverified_records"] += 1

            jurisdiction = (rec.get("region") or "").strip() or "Union of India"
            if jurisdiction.lower() == "unknown":
                jurisdiction = "Union of India"

            bail_cleaned.append({"case_id": case_id, "title": case_title, "court": court, "date": date_str, "checksum": checksum})
            normalized_docs.append(
                NormalizedLegalDocument(
                    document_id=f"bail1200:{case_id}",
                    source_dataset="IndianBailJudgments-1200",
                    source_type="COURT_JUDGMENT",
                    title=case_title[:255],
                    short_code=f"BAIL_{case_id}"[:64],
                    citation=f"{court} ({date_str})" if date_str else court,
                    act_or_judgment_identifier=f"Bail Judgment #{case_id} ({rec.get('source_filename') or ''})".strip()[:128],
                    jurisdiction=jurisdiction[:128],
                    court=court[:128],
                    publication_date=date_str if len(date_str) == 10 else None,
                    year=year,
                    document_version="1.0",
                    official_source_url=None,
                    original_repo_url=bail_entry["original_repo_url"],
                    original_file=bail_entry["original_filename"],
                    local_raw_path=bail_entry["local_path"],
                    license=bail_entry["license"],
                    verification_status="PENDING_VERIFICATION",
                    legal_currency_status="HISTORICAL_PRECEDENT_CITES_IPC_CRPC" if amendment_note else "CURRENT_PRECEDENT",
                    amendment_notes=amendment_note,
                    raw_text=clean_text,
                    content_checksum=checksum,
                    structured_payload={
                        "bail_type": rec.get("bail_type"),
                        "bail_outcome": rec.get("bail_outcome"),
                        "ipc_sections": ipc_secs,
                        "crime_type": rec.get("crime_type"),
                        "landmark_case": bool(rec.get("landmark_case")),
                        "source_filename": rec.get("source_filename"),
                    },
                )
            )

        audit["duplicates_removed"] += bail_dupes
        audit["dataset_counts"]["IndianBailJudgments-1200"] = {
            "raw_records": len(bail_records),
            "cleaned_records": len(bail_cleaned),
            "duplicates_removed": bail_dupes,
            "incomplete_skipped": bail_incomplete,
        }
        (cleaned_dir / "indian_bail_judgments_cleaned.jsonl").write_text(
            "\n".join(json.dumps(r, ensure_ascii=False) for r in bail_cleaned), encoding="utf-8"
        )

    # ── 2. Process IMLJD CSVs (sc_enriched.csv & hc_karnataka.csv) ───────────
    imljd_entries = [e for e in registry["downloaded_files"] if e["dataset_name"] == "IMLJD" and e["file_format"] == "CSV"]
    imljd_total_raw = 0
    imljd_total_kept = 0
    imljd_dupes = 0
    imljd_seen_keys: set[str] = set()
    imljd_cleaned_rows: List[Dict[str, Any]] = []

    for entry in imljd_entries:
        csv_path = satya_root / entry["local_path"]
        with csv_path.open("r", encoding="utf-8-sig", errors="replace") as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader, start=1):
                imljd_total_raw += 1
                title = (row.get("title") or "").strip()
                court = (row.get("court") or "Indian Court").strip()
                decision_date = (row.get("decision_date") or "").strip()
                cnr = (row.get("cnr") or "").strip()
                case_id = (row.get("case_id") or cnr or f"{csv_path.stem}_{idx}").strip()
                if not title:
                    audit["corrupted_or_incomplete_records"].append({
                        "dataset": "IMLJD",
                        "file": entry["original_filename"],
                        "row": idx,
                        "reason": "Missing case title",
                    })
                    continue

                dedup_key = cnr or f"{title.lower()}|{court.lower()}|{decision_date}"
                if dedup_key in imljd_seen_keys:
                    imljd_dupes += 1
                    continue
                imljd_seen_keys.add(dedup_key)

                statutes = (row.get("statutes") or "").strip()
                outcome = (row.get("outcome") or row.get("disposal_nature") or "").strip()
                case_type = (row.get("case_type") or "").strip()
                judge = (row.get("judge") or "").strip()
                citation = (row.get("citation") or row.get("nc_display") or "").strip()
                pdf_link = (row.get("pdf_link") or row.get("path") or "").strip()
                year_val = (row.get("year") or row.get("_year") or "").strip()
                year = int(year_val) if year_val.isdigit() else None

                signals = []
                for flag_col, label in [
                    ("arnesh_kumar_cited", "Arnesh Kumar guidelines cited"),
                    ("rajesh_sharma_cited", "Rajesh Sharma cited"),
                    ("mediation_mentioned", "Mediation mentioned"),
                    ("settlement_mentioned", "Settlement mentioned"),
                    ("judicial_criticism_misuse", "Judicial criticism of process misuse noted"),
                ]:
                    if str(row.get(flag_col, "")).lower() == "true":
                        signals.append(label)

                text_parts = [
                    f"Case Title: {title}",
                    f"Court: {court}" + (f" | Judge: {judge}" if judge else ""),
                    f"Decision Date: {decision_date or 'Unknown'}" + (f" | Citation: {citation}" if citation else "") + (f" | CNR: {cnr}" if cnr else ""),
                    f"Case Category: {case_type or 'matrimonial'} | Outcome / Disposal: {outcome or 'Unknown'}",
                    f"Statutes Invoked: {statutes or 'Not explicitly tagged (Matrimonial / IPC 498A / DV Act / CrPC 482)'}",
                    f"Judicial Signals: {'; '.join(signals)}" if signals else "",
                    f"Archive Reference: {pdf_link}" if pdf_link else "",
                    "Note: Record contains structured judicial metadata and outcome signals from AWS Open Data eCourts/Supreme Court archive (full judgment text not bundled in CSV).",
                ]
                clean_text = DocumentParser.clean_legal_text("\n".join(p for p in text_parts if p))
                checksum = sha256_text(clean_text)
                if checksum in seen_doc_checksums:
                    imljd_dupes += 1
                    continue
                seen_doc_checksums.add(checksum)

                jurisdiction = "Karnataka" if "karnataka" in court.lower() or "hc_karnataka" in csv_path.name else "Union of India"
                amendment_note = _detect_ipc_crpc_warning(statutes + " " + clean_text) or (
                    "Historical matrimonial decision (pre-BNSS/BNS); IPC 498A corresponds to BNS Sec 85-86 and CrPC 482 to BNSS Sec 528."
                )
                audit["outdated_or_superseded_records"] += 1
                audit["unverified_records"] += 1

                # Parse DD-MM-YYYY or YYYY-MM-DD safely
                iso_date = None
                if re.match(r"^\d{4}-\d{2}-\d{2}$", decision_date):
                    iso_date = decision_date
                elif re.match(r"^\d{2}-\d{2}-\d{4}$", decision_date):
                    d_p, m_p, y_p = decision_date.split("-")
                    iso_date = f"{y_p}-{m_p}-{d_p}"

                imljd_cleaned_rows.append({"case_id": case_id, "title": title, "court": court, "checksum": checksum})
                imljd_total_kept += 1
                normalized_docs.append(
                    NormalizedLegalDocument(
                        document_id=f"imljd:{csv_path.stem}:{case_id}",
                        source_dataset="IMLJD",
                        source_type="COURT_JUDGMENT",
                        title=title[:255],
                        short_code=f"IMLJD_{cnr or idx}"[:64],
                        citation=(citation or cnr or None),
                        act_or_judgment_identifier=(cnr or citation or case_id)[:128],
                        jurisdiction=jurisdiction,
                        court=court[:128],
                        publication_date=iso_date,
                        year=year,
                        document_version="1.0",
                        official_source_url="https://judgments.ecourts.gov.in/" if "ecourts" in pdf_link or cnr else "https://main.sci.gov.in/",
                        original_repo_url=entry["original_repo_url"],
                        original_file=entry["original_filename"],
                        local_raw_path=entry["local_path"],
                        license=entry["license"],
                        verification_status="PENDING_VERIFICATION",
                        legal_currency_status="HISTORICAL_PRECEDENT_CITES_IPC_CRPC",
                        amendment_notes=amendment_note,
                        raw_text=clean_text,
                        content_checksum=checksum,
                        structured_payload={
                            "cnr": cnr,
                            "outcome": outcome,
                            "case_type": case_type,
                            "statutes": statutes,
                            "pdf_link": pdf_link,
                            "content_completeness": "METADATA_AND_OUTCOME_RECORD_NO_FULL_TEXT",
                        },
                    )
                )

    audit["duplicates_removed"] += imljd_dupes
    audit["dataset_counts"]["IMLJD"] = {
        "raw_records": imljd_total_raw,
        "cleaned_records": imljd_total_kept,
        "duplicates_removed": imljd_dupes,
    }
    (cleaned_dir / "imljd_cleaned.jsonl").write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in imljd_cleaned_rows), encoding="utf-8"
    )

    # ── 3. Process gov-myscheme-dataset JSON ─────────────────────────────────
    scheme_entry = next(
        (e for e in registry["downloaded_files"] if e["dataset_name"] == "gov-myscheme-dataset" and e["file_format"] == "JSON"),
        None,
    )
    if scheme_entry:
        scheme_path = satya_root / scheme_entry["local_path"]
        scheme_records = json.loads(scheme_path.read_text(encoding="utf-8"))
        scheme_seen_slugs: set[str] = set()
        scheme_dupes = 0
        scheme_cleaned: List[Dict[str, Any]] = []

        for idx, rec in enumerate(scheme_records, start=1):
            name = (rec.get("Scheme Name") or "").strip()
            slug = (rec.get("Scheme Slug") or f"scheme-{idx}").strip()
            if not name:
                audit["corrupted_or_incomplete_records"].append({
                    "dataset": "gov-myscheme-dataset",
                    "record_id": slug,
                    "reason": "Missing Scheme Name",
                })
                continue
            if slug in scheme_seen_slugs:
                scheme_dupes += 1
                continue
            scheme_seen_slugs.add(slug)

            level = (rec.get("Level") or "").strip()
            ministry_or_state = (rec.get("State / UT / Ministry") or "").strip()
            jurisdiction = "Union of India" if "central" in level.lower() else (ministry_or_state or "India State/UT")
            myscheme_url = (rec.get("MyScheme URL") or "").strip() or None
            official_link = (rec.get("Official Link") or "").strip() or None
            canonical_url = myscheme_url or official_link

            sections_data = [
                {"label": "Overview & Description", "text": f"Level: {level} | Nodal Authority: {ministry_or_state} | Mode: {rec.get('Application Mode') or ''}\nTags: {rec.get('Tags / Categories') or ''}\n\n{rec.get('Description') or ''}"},
                {"label": "Eligibility Criteria & Exclusions", "text": f"{rec.get('Eligibility Criteria') or ''}\n\nExclusions / Ineligibility: {rec.get('Exclusions / Ineligibility') or 'None listed'}"},
                {"label": "Benefits", "text": str(rec.get("Benefits") or "")},
                {"label": "Application Process & Required Documents", "text": f"{rec.get('Application Process') or ''}\n\nDocuments Required:\n{rec.get('Documents Required') or ''}"},
                {"label": "Frequently Asked Questions", "text": str(rec.get("Frequently Asked Questions (FAQs)") or "")},
            ]
            combined_text = DocumentParser.clean_legal_text("\n\n".join(f"{s['label']}:\n{s['text']}" for s in sections_data if s["text"].strip()))
            checksum = sha256_text(combined_text)
            if checksum in seen_doc_checksums:
                scheme_dupes += 1
                continue
            seen_doc_checksums.add(checksum)

            legacy_flag = "udyog aadhar" in combined_text.lower()
            amendment_note = (
                "Scheme snapshot from 2026-10-07 (references legacy Udyog Aadhar registration; verify current Udyam / live MyScheme portal)."
                if legacy_flag
                else "Scheme snapshot from 2026-10-07; verify active status and benefit norms on official MyScheme portal."
            )

            scheme_cleaned.append({"slug": slug, "name": name, "jurisdiction": jurisdiction, "checksum": checksum})
            normalized_docs.append(
                NormalizedLegalDocument(
                    document_id=f"myscheme:{slug}",
                    source_dataset="gov-myscheme-dataset",
                    source_type="GOVERNMENT_SCHEME",
                    title=name[:255],
                    short_code=f"SCHEME_{slug.upper().replace('-', '_')}"[:64],
                    citation=f"MyScheme ({slug})",
                    act_or_judgment_identifier=slug[:128],
                    jurisdiction=jurisdiction[:128],
                    court=None,
                    publication_date="2026-10-07",
                    year=2026,
                    document_version="2026.10",
                    official_source_url=canonical_url,
                    original_repo_url=scheme_entry["original_repo_url"],
                    original_file=scheme_entry["original_filename"],
                    local_raw_path=scheme_entry["local_path"],
                    license=scheme_entry["license"],
                    verification_status="SECONDARY_MIRROR_WITH_GOV_URLS",
                    legal_currency_status="SNAPSHOT_SUBJECT_TO_SCHEME_UPDATES",
                    amendment_notes=amendment_note,
                    raw_text=combined_text,
                    content_checksum=checksum,
                    structured_payload={
                        "scheme_slug": slug,
                        "ministry_or_state": ministry_or_state,
                        "official_link": official_link,
                        "myscheme_url": myscheme_url,
                        "sections": sections_data,
                    },
                )
            )

        audit["duplicates_removed"] += scheme_dupes
        audit["dataset_counts"]["gov-myscheme-dataset"] = {
            "raw_records": len(scheme_records),
            "cleaned_records": len(scheme_cleaned),
            "duplicates_removed": scheme_dupes,
        }
        (cleaned_dir / "gov_myscheme_cleaned.jsonl").write_text(
            "\n".join(json.dumps(r, ensure_ascii=False) for r in scheme_cleaned), encoding="utf-8"
        )

    # ── 4. Process AI-Law-Chatbot PDFs ───────────────────────────────────────
    pdf_entries = [e for e in registry["downloaded_files"] if e["dataset_name"] == "AI-Law-Chatbot-Datasets" and e["file_format"] == "PDF"]
    pdf_processed_count = 0
    pdf_skipped_corrupt = 0

    for entry in pdf_entries:
        pdf_path = satya_root / entry["local_path"]
        extracted_text, info = extract_pdf_safe(pdf_path)
        audit["pdf_inspection_results"].append({
            "file": entry["local_path"],
            "original_filename": entry["original_filename"],
            **info,
        })

        if not extracted_text or info["status"].startswith("CORRUPTED") or info["status"] == "SCANNED_OR_EMPTY_TEXT_LAYER":
            pdf_skipped_corrupt += 1
            audit["corrupted_or_incomplete_records"].append({
                "dataset": "AI-Law-Chatbot-Datasets",
                "file": entry["local_path"],
                "reason": info["status"],
                "pages": info.get("pages", 0),
                "extracted_chars": info.get("extracted_chars", 0),
            })
            continue

        checksum = sha256_text(extracted_text)
        if checksum in seen_doc_checksums:
            audit["duplicates_removed"] += 1
            continue
        seen_doc_checksums.add(checksum)

        stem = pdf_path.stem
        pretty_title = stem.replace("_", " ").replace("-", " ").title()
        if "SUPERSEDED" in stem:
            pretty_title = "The Indian Penal Code, 1860 (Repealed / Superseded by BNS 2023)"
        elif "ABOLISHED" in stem:
            pretty_title = "The Wealth-tax Act, 1957 (Abolished via Finance Act, 2015)"

        is_judgment = "court_judgments/" in entry["local_path"]
        is_policy = "government_notifications_and_circulars/" in entry["local_path"] or "other_legal_documents/" in entry["local_path"]
        source_type = "COURT_JUDGMENT" if is_judgment else ("POLICY_REPORT" if is_policy else "BARE_ACT")

        currency = entry["legal_currency_status"]
        amendment_note = entry["notes"]
        if stem == "constitution_of_india":
            currency = "OUTDATED_AS_OF_2020_12_09_MISSING_105_106_AMENDMENTS"
            amendment_note = "PDF edition is as on 9 December 2020 (up to 104th Amendment Act, 2019); missing 105th (2021) and 106th (2023) Constitutional Amendments."
            audit["outdated_or_superseded_records"] += 1
        elif any(tag in currency for tag in ("REPEALED", "ABOLISHED", "SUPERSEDED", "AMENDED", "VERIFY")):
            audit["outdated_or_superseded_records"] += 1
        audit["unverified_records"] += 1

        pdf_processed_count += 1
        normalized_docs.append(
            NormalizedLegalDocument(
                document_id=f"pdf:{stem}",
                source_dataset="AI-Law-Chatbot-Datasets",
                source_type=source_type,
                title=pretty_title[:255],
                short_code=f"EXT_{stem.upper()}"[:64],
                citation=entry["source_and_jurisdiction"][:255],
                act_or_judgment_identifier=stem[:128],
                jurisdiction=entry["jurisdiction"][:128],
                court="Supreme Court of India" if is_judgment else None,
                publication_date=entry["publication_or_update_date"] if re.match(r"^\d{4}-\d{2}-\d{2}$", entry["publication_or_update_date"]) else None,
                year=int(entry["publication_or_update_date"][:4]) if entry["publication_or_update_date"][:4].isdigit() else None,
                document_version="1.0",
                official_source_url=None,
                original_repo_url=entry["original_repo_url"],
                original_file=entry["original_filename"],
                local_raw_path=entry["local_path"],
                license=entry["license"],
                verification_status=entry["verification_status"],
                legal_currency_status=currency,
                amendment_notes=amendment_note,
                raw_text=extracted_text,
                content_checksum=checksum,
                structured_payload={"pdf_inspection": info},
            )
        )

    audit["dataset_counts"]["AI-Law-Chatbot-Datasets"] = {
        "raw_pdfs": len(pdf_entries),
        "processed_pdfs": pdf_processed_count,
        "skipped_corrupt_or_scanned": pdf_skipped_corrupt,
    }

    # Write normalized documents JSONL
    norm_path = normalized_dir / "normalized_documents.jsonl"
    with norm_path.open("w", encoding="utf-8") as nf:
        for doc in normalized_docs:
            nf.write(json.dumps(asdict(doc), ensure_ascii=False) + "\n")

    # ── Phase 4: Chunk all normalized documents with full traceability ───────
    all_chunks: List[Dict[str, Any]] = []
    chunk_counts_by_dataset: Dict[str, int] = {}
    toc_stubs_filtered = 0

    for doc in normalized_docs:
        parsed: List[ParsedLegalChunk]
        if doc.source_type == "BARE_ACT":
            # Strip front-matter "ARRANGEMENT OF SECTIONS" TOC before enacting formula if present
            statute_text = doc.raw_text
            if len(statute_text) > 10000:
                enact_match = re.search(
                    r"(?:BE it enacted by Parliament|WE,\s*THE PEOPLE OF INDIA)",
                    statute_text[:80000],
                    re.IGNORECASE,
                )
                if enact_match and enact_match.start() > 500:
                    statute_text = statute_text[enact_match.start() :]
            parsed = LegalChunker.chunk_statute_text(
                text=statute_text,
                act_title=doc.title,
                jurisdiction=doc.jurisdiction,
                document_version=doc.document_version,
                short_code=doc.short_code,
            )
            # Filter remaining single-line TOC stubs (heading-only chunks < 100 chars when fuller body exists)
            filtered_parsed: List[ParsedLegalChunk] = []
            for ch in parsed:
                if (
                    len(parsed) > 10
                    and ch.clause_heading
                    and ch.chunk_text.strip() == ch.clause_heading.strip()
                    and len(ch.chunk_text.strip()) < 100
                ):
                    toc_stubs_filtered += 1
                    continue
                filtered_parsed.append(ch)
            parsed = filtered_parsed or parsed
        elif doc.source_type == "COURT_JUDGMENT":
            if doc.source_dataset in ("IndianBailJudgments-1200", "IMLJD"):
                # Structured judgment summaries are single-record or paragraph-split if long
                parsed = LegalChunker.chunk_judgment_text(
                    text=doc.raw_text,
                    case_title=doc.title,
                    jurisdiction=doc.jurisdiction,
                    court=doc.court,
                    decision_date=doc.publication_date,
                    citation=doc.citation,
                    document_version=doc.document_version,
                    max_chars=2600,
                )
            else:
                parsed = LegalChunker.chunk_judgment_text(
                    text=doc.raw_text,
                    case_title=doc.title,
                    jurisdiction=doc.jurisdiction,
                    court=doc.court,
                    decision_date=doc.publication_date,
                    citation=doc.citation,
                    document_version=doc.document_version,
                    max_chars=2400,
                )
        elif doc.source_type == "GOVERNMENT_SCHEME" and doc.structured_payload:
            parsed = LegalChunker.chunk_policy_scheme(
                scheme_name=doc.title,
                scheme_slug=doc.structured_payload["scheme_slug"],
                sections=doc.structured_payload["sections"],
                jurisdiction=doc.jurisdiction,
                ministry_or_state=doc.structured_payload.get("ministry_or_state"),
                official_url=doc.official_source_url,
                document_version=doc.document_version,
                max_chars=2800,
            )
        else:
            parsed = LegalChunker.chunk_judgment_text(
                text=doc.raw_text,
                case_title=doc.title,
                jurisdiction=doc.jurisdiction,
                court=doc.court,
                decision_date=doc.publication_date,
                citation=doc.citation,
                document_version=doc.document_version,
                max_chars=2400,
            )

        for idx, ch in enumerate(parsed, start=1):
            chunk_meta = dict(ch.metadata or {})
            chunk_meta.update({
                "source_dataset": doc.source_dataset,
                "original_repo_url": doc.original_repo_url,
                "original_file": doc.original_file,
                "local_raw_path": doc.local_raw_path,
                "document_id": doc.document_id,
                "license": doc.license,
                "verification_status": doc.verification_status,
                "legal_currency_status": doc.legal_currency_status,
                "amendment_notes": doc.amendment_notes,
            })
            if doc.structured_payload and "content_completeness" in doc.structured_payload:
                chunk_meta["content_completeness"] = doc.structured_payload["content_completeness"]

            chunk_record = {
                "chunk_id": f"{doc.document_id}#c{idx}",
                "document_id": doc.document_id,
                "source_dataset": doc.source_dataset,
                "source_type": doc.source_type,
                "title": doc.title,
                "short_code": doc.short_code,
                "citation": doc.citation,
                "act_or_judgment_identifier": doc.act_or_judgment_identifier,
                "section_number": ch.section_number,
                "clause_heading": ch.clause_heading,
                "chunk_text": ch.chunk_text,
                "token_count": ch.token_count,
                "content_checksum": ch.content_checksum,
                "jurisdiction": doc.jurisdiction,
                "court": doc.court,
                "publication_date": doc.publication_date,
                "year": doc.year,
                "document_version": doc.document_version,
                "official_source_url": doc.official_source_url,
                "original_repo_url": doc.original_repo_url,
                "original_file": doc.original_file,
                "local_raw_path": doc.local_raw_path,
                "verification_status": doc.verification_status,
                "legal_currency_status": doc.legal_currency_status,
                "amendment_notes": doc.amendment_notes,
                "metadata_json": chunk_meta,
            }
            all_chunks.append(chunk_record)
            chunk_counts_by_dataset[doc.source_dataset] = chunk_counts_by_dataset.get(doc.source_dataset, 0) + 1

    chunks_path = chunked_dir / "rag_chunks.jsonl"
    with chunks_path.open("w", encoding="utf-8") as cf:
        for ch in all_chunks:
            cf.write(json.dumps(ch, ensure_ascii=False) + "\n")

    audit["total_documents_processed"] = len(normalized_docs)
    audit["total_chunks_generated"] = len(all_chunks)
    audit["toc_stubs_filtered"] = toc_stubs_filtered
    audit["chunks_by_dataset"] = chunk_counts_by_dataset

    (metadata_dir / "preprocessing_audit.json").write_text(
        json.dumps(audit, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return audit
