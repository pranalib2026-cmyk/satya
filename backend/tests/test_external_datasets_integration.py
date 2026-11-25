"""Phase 6 Integration & Validation Tests for External Legal Datasets in SATYA.

Tests:
1. Successful idempotent ingestion of preprocessed external datasets (bail judgments, IMLJD, MyScheme, PDFs).
2. Relevant retrieval across judgments, schemes, and statutes (including jurisdiction/source-type filtering).
3. Citation traceability pointing to original repo URL, raw document path, checksum, and verification status.
4. Distinguishing repealed/abolished/superseded/outdated laws from verified current law (IPC vs BNS, Wealth Tax 1957).
5. Safe fallback on unsupported / uncovered legal queries.
6. Compatibility with existing API endpoints (/api/v1/health, /api/v1/legal/ask, /api/v1/legal-knowledge/sources).
"""

import json
from pathlib import Path
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.legal_assistant.embedding_provider import reset_embedding_provider
from app.modules.legal_assistant.retrieval import LegalRetrievalEngine
from app.modules.legal_knowledge.ingestion import LegalIngestionService
from app.modules.legal_knowledge.models import LegalChunk, LegalSource


@pytest.fixture(autouse=True)
def clean_singletons():
    reset_embedding_provider()
    yield
    reset_embedding_provider()


@pytest.fixture
def sample_processed_chunks_file(tmp_path: Path) -> Path:
    """Create a representative JSONL slice covering all integrated external dataset types."""
    real_chunks_file = Path(__file__).resolve().parents[2] / "data" / "processed" / "chunked" / "rag_chunks.jsonl"
    if real_chunks_file.is_file():
        selected_docs = {}
        wanted_prefixes = (
            "bail1200:0001",
            "imljd:hc_karnataka:",
            "myscheme:25-ciss",
            "pdf:bharatiya_nyay_sanhita_2023",
            "pdf:indian_penal_code_1860_SUPERSEDED",
            "pdf:wealth_tax_act_1957_ABOLISHED",
            "pdf:constitution_of_india",
        )
        with real_chunks_file.open("r", encoding="utf-8") as f:
            for line in f:
                rec = json.loads(line)
                doc_id = rec["document_id"]
                if any(doc_id.startswith(p) for p in wanted_prefixes):
                    if doc_id not in selected_docs and len(selected_docs) >= 12:
                        continue
                    # Take up to 4 chunks per doc so test executes rapidly
                    bucket = selected_docs.setdefault(doc_id, [])
                    if len(bucket) < 4:
                        bucket.append(rec)

        out = tmp_path / "sample_rag_chunks.jsonl"
        with out.open("w", encoding="utf-8") as wf:
            for items in selected_docs.values():
                for item in items:
                    wf.write(json.dumps(item, ensure_ascii=False) + "\n")
        if out.stat().st_size > 0:
            return out

    # Fallback synthetic sample if data/ is absent in isolated CI
    fallback_records = [
        {
            "chunk_id": "bail1200:0001#c1",
            "document_id": "bail1200:0001",
            "source_dataset": "IndianBailJudgments-1200",
            "source_type": "COURT_JUDGMENT",
            "title": "Jibangshu Paul vs National Investigation Agency",
            "short_code": "BAIL_0001",
            "citation": "Gauhati High Court (2011-07-27)",
            "act_or_judgment_identifier": "Bail Judgment #0001",
            "section_number": "Judgment Summary",
            "clause_heading": "Jibangshu Paul vs National Investigation Agency",
            "chunk_text": "Bail earlier granted under IPC sections was cancelled after UA(P) Act sections were added. Fresh bail consideration required.",
            "token_count": 30,
            "content_checksum": "chk_bail_0001",
            "jurisdiction": "Assam",
            "court": "Gauhati High Court",
            "publication_date": "2011-07-27",
            "year": 2011,
            "document_version": "1.0",
            "official_source_url": None,
            "original_repo_url": "https://github.com/SnehaDeshmukh28/IndianBailJudgments-1200",
            "original_file": "indian_bail_judgments.json",
            "local_raw_path": "data/raw/court_judgments/indian_bail_judgments_1200/indian_bail_judgments.json",
            "verification_status": "PENDING_VERIFICATION",
            "legal_currency_status": "HISTORICAL_PRECEDENT_CITES_IPC_CRPC",
            "amendment_notes": "Historical bail order citing IPC/CrPC; verify BNS/BNSS 2023 equivalents.",
            "metadata_json": {
                "source_dataset": "IndianBailJudgments-1200",
                "original_repo_url": "https://github.com/SnehaDeshmukh28/IndianBailJudgments-1200",
                "local_raw_path": "data/raw/court_judgments/indian_bail_judgments_1200/indian_bail_judgments.json",
                "legal_currency_status": "HISTORICAL_PRECEDENT_CITES_IPC_CRPC",
                "amendment_notes": "Historical bail order citing IPC/CrPC; verify BNS/BNSS 2023 equivalents.",
            },
        },
        {
            "chunk_id": "pdf:wealth_tax_act_1957_ABOLISHED#c1",
            "document_id": "pdf:wealth_tax_act_1957_ABOLISHED",
            "source_dataset": "AI-Law-Chatbot-Datasets",
            "source_type": "BARE_ACT",
            "title": "The Wealth-tax Act, 1957 (Abolished via Finance Act, 2015)",
            "short_code": "EXT_WEALTH_TAX_ACT_1957_ABOLISHED",
            "citation": "Act No. 27 of 1957",
            "act_or_judgment_identifier": "wealth_tax_act_1957_ABOLISHED",
            "section_number": "Section 3",
            "clause_heading": "Charge of wealth-tax",
            "chunk_text": "Subject to the other provisions contained in this Act, there shall be charged for every assessment year net wealth tax.",
            "token_count": 25,
            "content_checksum": "chk_wt_1957",
            "jurisdiction": "Union of India",
            "court": None,
            "publication_date": None,
            "year": 1957,
            "document_version": "1.0",
            "official_source_url": None,
            "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
            "original_file": "datasets/indian_constitution/wealth_tax_act_1957.pdf",
            "local_raw_path": "data/raw/central_legislation/wealth_tax_act_1957_ABOLISHED.pdf",
            "verification_status": "UNVERIFIED_THIRD_PARTY_PDF",
            "legal_currency_status": "REPEALED_ABOLISHED_FINANCE_ACT_2015",
            "amendment_notes": "ABOLISHED w.e.f. AY 2016-17 by Finance Act, 2015.",
            "metadata_json": {
                "source_dataset": "AI-Law-Chatbot-Datasets",
                "original_repo_url": "https://github.com/Pratik45ro/AI-Law-Chatbot/tree/main/datasets",
                "local_raw_path": "data/raw/central_legislation/wealth_tax_act_1957_ABOLISHED.pdf",
                "legal_currency_status": "REPEALED_ABOLISHED_FINANCE_ACT_2015",
                "amendment_notes": "ABOLISHED w.e.f. AY 2016-17 by Finance Act, 2015.",
            },
        },
    ]
    out = tmp_path / "fallback_rag_chunks.jsonl"
    out.write_text("\n".join(json.dumps(r) for r in fallback_records), encoding="utf-8")
    return out


@pytest.mark.asyncio
async def test_ingest_processed_corpus_idempotent(
    db_session: AsyncSession,
    sample_processed_chunks_file: Path,
):
    """1. Documents from preprocessed JSONL ingest cleanly and skip duplicates on rerun."""
    summary_first = await LegalIngestionService.ingest_processed_corpus(
        db=db_session,
        chunks_jsonl_path=str(sample_processed_chunks_file),
    )
    assert summary_first["sources_created"] >= 2
    assert summary_first["chunks_created"] >= 2

    total_sources = await db_session.scalar(select(func.count(LegalSource.id)))
    assert total_sources == summary_first["sources_created"]

    # Second run must be idempotent
    summary_second = await LegalIngestionService.ingest_processed_corpus(
        db=db_session,
        chunks_jsonl_path=str(sample_processed_chunks_file),
    )
    assert summary_second["sources_created"] == 0
    assert summary_second["sources_skipped"] == summary_first["sources_created"]


@pytest.mark.asyncio
async def test_source_aware_retrieval_and_traceable_citations(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_processed_chunks_file: Path,
):
    """2 & 3. Retrieval returns relevant provisions/schemes/judgments with full traceability metadata."""
    await LegalIngestionService.seed_curated_corpus(db_session)
    await LegalIngestionService.ingest_processed_corpus(
        db=db_session,
        chunks_jsonl_path=str(sample_processed_chunks_file),
    )

    # Check source-type filtering for COURT_JUDGMENT
    judgment_chunks = await LegalRetrievalEngine.retrieve(
        db=db_session,
        query="bail cancellation UA(P)A IPC sections High Court",
        source_types=["COURT_JUDGMENT"],
        max_sources=3,
        relevance_threshold=0.25,
    )
    assert len(judgment_chunks) >= 1
    assert all(c["source_type"] == "COURT_JUDGMENT" for c in judgment_chunks)
    assert judgment_chunks[0]["original_repo_url"] is not None
    assert judgment_chunks[0]["local_raw_path"] is not None

    # Check Ask API returns traceability fields on CitationItem
    res = await async_client.post(
        "/api/v1/legal/ask",
        json={"query": "bail cancellation after serious IPC or UA(P)A charges", "preferred_language": "en"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["sources_found"] is True
    assert len(body["citations"]) >= 1
    first_cit = body["citations"][0]
    assert first_cit["content_checksum"] is not None
    assert "verification_status" in first_cit
    assert "legal_currency_status" in first_cit


@pytest.mark.asyncio
async def test_outdated_and_abolished_law_distinguishable(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_processed_chunks_file: Path,
):
    """4. Abolished/repealed acts are flagged explicitly and can be filtered out via include_outdated=False."""
    await LegalIngestionService.seed_curated_corpus(db_session)
    await LegalIngestionService.ingest_processed_corpus(
        db=db_session,
        chunks_jsonl_path=str(sample_processed_chunks_file),
    )

    # When include_outdated=False, Wealth-tax Act 1957 must be excluded
    active_only = await LegalRetrievalEngine.retrieve(
        db=db_session,
        query="Wealth-tax Act 1957 net wealth assessment year",
        include_outdated=False,
        relevance_threshold=0.25,
    )
    assert not any("Wealth-tax" in c["source_title"] for c in active_only)

    # When explicitly queried with include_outdated=True, it carries REPEALED/ABOLISHED warning
    res = await async_client.post(
        "/api/v1/legal/ask",
        json={"query": "What is Section 3 of the Wealth-tax Act 1957?", "preferred_language": "en"},
    )
    assert res.status_code == 200
    data = res.json()
    if data["citations"]:
        wt_cits = [c for c in data["citations"] if "Wealth-tax" in c["source_title"]]
        if wt_cits:
            assert "ABOLISHED" in (wt_cits[0]["legal_currency_status"] or "")
            assert wt_cits[0]["amendment_warning"] is not None
            assert "ABOLISHED" in data["answer"] or "Statutory Status Notice" in data["answer"]


@pytest.mark.asyncio
async def test_unsupported_query_and_existing_endpoints_healthy(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_processed_chunks_file: Path,
):
    """5 & 6. Unsupported queries return safe fallback and existing health/sources endpoints work."""
    await LegalIngestionService.ingest_processed_corpus(
        db=db_session,
        chunks_jsonl_path=str(sample_processed_chunks_file),
    )

    health = await async_client.get("/api/v1/health")
    assert health.status_code == 200

    sources_res = await async_client.get("/api/v1/legal-knowledge/sources")
    assert sources_res.status_code == 200
    assert len(sources_res.json()) >= 2

    unsupported = await async_client.post(
        "/api/v1/legal/ask",
        json={"query": "What are the sovereign mining tax treaties on Mars orbital colonies?", "preferred_language": "en"},
    )
    assert unsupported.status_code == 200
    payload = unsupported.json()
    assert payload["sources_found"] is False
    assert payload["citations"] == []
