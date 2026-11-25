"""Comprehensive test suite for Legal AI Assistant (RAG) and Admin Ingestion."""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.admin.models import AuditLog
from app.modules.legal_assistant.citation_validator import CitationValidator
from app.modules.legal_assistant.embedding_provider import (
    DeterministicMockEmbeddingProvider,
    get_embedding_provider,
)
from app.modules.legal_assistant.llm_provider import (
    DeterministicGroundedLLMProvider,
    get_llm_provider,
)
from app.modules.legal_knowledge.ingestion import LegalIngestionService
from app.modules.legal_knowledge.models import LegalChunk, LegalSource
from app.modules.users.models import User


async def create_user_and_token(
    async_client: AsyncClient,
    db_session: AsyncSession,
    role: str = "CITIZEN",
    email: str = "rag.test@example.com",
) -> tuple[str, str]:
    """Helper to register and login user with specified role."""
    password = "SecurePassword2026"
    user = User(
        full_name="Test User",
        email=email,
        phone="+919876543999" if role == "ADMIN" else "+919876543998",
        password_hash=hash_password(password),
        role=role,
        is_verified=True,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200
    return str(user.id), login_res.json()["access_token"]


# ──────────────────────────────────────────────────────────────
# 1. Statutory Retrieval & Grounded Question Answering
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_legal_ask_cheque_bounce_retrieval(async_client: AsyncClient, db_session: AsyncSession):
    """Verify inquiry regarding cheque bounce retrieves Section 138 NI Act with verified citation and next steps."""
    # Ensure corpus seeded
    await LegalIngestionService.seed_curated_corpus(db_session)

    payload = {
        "query": "My business client gave me a cheque of Rs 5 Lakhs which bounced due to insufficient funds. What is the procedure under Section 138?",
        "preferred_language": "en",
        "max_sources": 3,
    }

    res = await async_client.post("/api/v1/legal/ask", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["query"] == payload["query"]
    assert data["detected_language"] == "en"
    assert data["sources_found"] is True
    assert "Section 138" in data["answer"]
    assert "Negotiable Instruments Act" in data["answer"]
    assert data["retrieved_chunks_count"] >= 1

    # Verify Citations
    citations = data["citations"]
    assert len(citations) >= 1
    c0 = citations[0]
    assert "Negotiable Instruments Act" in c0["source_title"]
    assert "Section 138" in c0["section_or_paragraph"]
    assert c0["is_verified_in_corpus"] is True
    assert c0["official_source_url"] is not None
    assert c0["content_checksum"] is not None

    # Verify Actionable Next Steps
    next_steps = " ".join(data["suggested_next_steps"])
    assert "notice" in next_steps.lower()
    assert "30 days" in next_steps.lower() or "15 days" in next_steps.lower()

    # Verify Mandatory Disclaimer
    assert "does not constitute formal legal advice" in data["disclaimer"]


@pytest.mark.asyncio
async def test_legal_ask_consumer_dispute_retrieval(async_client: AsyncClient, db_session: AsyncSession):
    """Verify consumer grievance retrieves Consumer Protection Act 2019 provisions."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    payload = {
        "query": "How to file a consumer complaint for a defective electronic product?",
        "preferred_language": "en",
    }

    res = await async_client.post("/api/v1/legal/ask", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["sources_found"] is True
    assert "Consumer Protection Act" in data["answer"] or "Section 35" in data["answer"]

    # Verify consumer citations
    titles = [c["source_title"] for c in data["citations"]]
    assert any("Consumer Protection Act" in t for t in titles)


@pytest.mark.asyncio
async def test_legal_ask_free_legal_aid_entitlement(async_client: AsyncClient, db_session: AsyncSession):
    """Verify inquiry about free legal aid retrieves Section 12 Legal Services Authorities Act."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    payload = {
        "query": "Who is eligible to get free legal aid under NALSA in India?",
        "preferred_language": "en",
    }

    res = await async_client.post("/api/v1/legal/ask", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["sources_found"] is True
    assert "Legal Services Authorities Act" in data["answer"]
    assert "Section 12" in data["answer"]


# ──────────────────────────────────────────────────────────────
# 2. Strict Safety Rules & Missing Sources
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_legal_ask_insufficient_sources_returns_safe_fallback(async_client: AsyncClient):
    """Ensure out-of-scope inquiry returns safe fallback without hallucinating or making speculative assertions."""
    payload = {
        "query": "What is the maritime salvage protocol for an extraterrestrial spacecraft in international waters under Neptune Treaty?",
        "preferred_language": "en",
    }

    res = await async_client.post("/api/v1/legal/ask", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["sources_found"] is False
    assert len(data["citations"]) == 0
    assert "No verified legal sources found" in data["answer"]
    assert "will not generate speculative or ungrounded" in data["answer"]
    assert any("Consult an empanelled advocate" in step for step in data["suggested_next_steps"])


# ──────────────────────────────────────────────────────────────
# 3. Citation Validator Unit Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_citation_validator_prunes_hallucinations():
    """Verify CitationValidator excludes cited sections that were never part of the retrieved chunks."""
    retrieved_chunks = [
        {
            "section_number": "Section 138",
            "source_title": "The Negotiable Instruments Act, 1881",
            "source_type": "BARE_ACT",
            "act_or_judgment_identifier": "Act No. 26 of 1881",
            "clause_heading": "Dishonour of cheque",
            "official_source_url": "https://indiacode.nic.in",
            "content_checksum": "abc123hash",
        }
    ]

    # LLM claimed both Section 138 (valid) and Section 420 IPC (hallucinated / not retrieved)
    claimed_references = [
        {
            "section_or_paragraph": "Section 138",
            "source_title": "The Negotiable Instruments Act, 1881",
        },
        {
            "section_or_paragraph": "Section 420",
            "source_title": "Indian Penal Code",
        },
    ]

    answer_text = "Under Section 138 of NI Act and also Section 420 of IPC, offences are punishable."

    verified, unverified = CitationValidator.validate_and_filter_citations(
        answer_text=answer_text,
        claimed_references=claimed_references,
        retrieved_chunks=retrieved_chunks,
    )

    # Section 138 is verified
    assert len(verified) == 1
    assert verified[0].section_or_paragraph == "Section 138"
    assert verified[0].is_verified_in_corpus is True

    # Section 420 IPC is flagged and pruned
    assert len(unverified) >= 1
    unverified_text = " ".join(unverified)
    assert "420" in unverified_text


# ──────────────────────────────────────────────────────────────
# 4. Multi-Language Script Detection (Hindi & Kannada)
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_language_detection_and_multi_language_support(async_client: AsyncClient, db_session: AsyncSession):
    """Verify Hindi and Kannada queries are detected and answered with correct language metadata."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    # 1. Hindi Query in Devanagari Script
    hindi_res = await async_client.post(
        "/api/v1/legal/ask",
        json={"query": "चेक बाउंस होने पर क्या कानूनी प्रक्रिया है?"},
    )
    assert hindi_res.status_code == 200
    hindi_data = hindi_res.json()
    assert hindi_data["detected_language"] == "hi"
    assert "हिंदी" in hindi_data["answer"]

    # 2. Kannada Query in Kannada Script
    kannada_res = await async_client.post(
        "/api/v1/legal/ask",
        json={"query": "ಗ್ರಾಹಕರ ರಕ್ಷಣಾ ಕಾಯ್ದೆಯಡಿ ದೂರು ದಾಖಲಿಸುವುದು ಹೇಗೆ?"},
    )
    assert kannada_res.status_code == 200
    kannada_data = kannada_res.json()
    assert kannada_data["detected_language"] == "kn"
    assert "ಕನ್ನಡ" in kannada_data["answer"]


# ──────────────────────────────────────────────────────────────
# 5. Protected Admin Source Ingestion Workflows
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_source_ingestion_workflow(async_client: AsyncClient, db_session: AsyncSession):
    """Verify admin registers legal source, ingests statutory chunk, and lists verified sources."""
    admin_id, admin_token = await create_user_and_token(
        async_client,
        db_session,
        role="ADMIN",
        email="superadmin.rag@nyayasetu.in",
    )

    # 1. Admin creates new legal source
    source_payload = {
        "title": "The Arbitration and Conciliation Act, 1996",
        "source_type": "BARE_ACT",
        "short_code": "ACA_1996",
        "citation": "Act No. 26 of 1996",
        "act_or_judgment_identifier": "Act No. 26 of 1996",
        "jurisdiction": "Union of India",
        "document_version": "2026.1",
        "official_source_url": "https://www.indiacode.nic.in/handle/123456789/1978",
    }

    create_res = await async_client.post(
        "/api/v1/legal/admin/sources",
        json=source_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    source_id = create_res.json()["id"]

    # 2. Admin ingests chunk
    chunk_payload = {
        "section_number": "Section 9",
        "clause_heading": "Interim measures, etc., by Court",
        "chunk_text": "A party may, before or during arbitral proceedings or at any time after the making of the arbitral award, apply to a court for interim measures of protection.",
    }

    chunk_res = await async_client.post(
        f"/api/v1/legal/admin/sources/{source_id}/chunks",
        json=chunk_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert chunk_res.status_code == 201
    chunk_data = chunk_res.json()
    assert chunk_data["status"] == "embedded_and_stored"
    assert chunk_data["content_checksum"] is not None

    # 3. Admin lists sources
    list_res = await async_client.get(
        "/api/v1/legal/admin/sources",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_res.status_code == 200
    sources_list = list_res.json()
    assert any(s["id"] == source_id for s in sources_list)


@pytest.mark.asyncio
async def test_admin_ingestion_access_control(async_client: AsyncClient, db_session: AsyncSession):
    """Ensure citizens and unauthenticated users cannot access admin knowledge ingestion routes."""
    citizen_id, citizen_token = await create_user_and_token(
        async_client,
        db_session,
        role="CITIZEN",
        email="unauthorized.citizen@example.com",
    )

    # Citizen receives 403 Forbidden
    res_citizen = await async_client.post(
        "/api/v1/legal/admin/sources",
        json={"title": "Test Act", "source_type": "BARE_ACT", "jurisdiction": "Delhi"},
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res_citizen.status_code == 403

    # Unauthenticated receives 401 Unauthorized
    res_unauth = await async_client.post(
        "/api/v1/legal/admin/sources",
        json={"title": "Test Act", "source_type": "BARE_ACT", "jurisdiction": "Delhi"},
    )
    assert res_unauth.status_code == 401


# ──────────────────────────────────────────────────────────────
# 6. Audit Trail for Legal AI Queries
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_audit_log_recorded_for_legal_ai_queries(async_client: AsyncClient, db_session: AsyncSession):
    """Verify that asking a legal question creates an immutable audit trail entry."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    res = await async_client.post(
        "/api/v1/legal/ask",
        json={"query": "What are the rights of an undertrial prisoner regarding bail?"},
    )
    assert res.status_code == 200

    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "legal_assistant_rag",
            AuditLog.action == "LEGAL_AI_QUERY_ANSWERED",
        )
    )
    audit = audit_res.scalar_one_or_none()
    assert audit is not None
    assert "undertrial" in audit.payload_snapshot["query"].lower()
    assert audit.payload_snapshot["sources_found"] is True


@pytest.mark.asyncio
async def test_ask_me_grounded_provisions_simplify_solutions_and_escalation(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify /api/v1/legal/ask-me returns grounded sections, simplified text, solutions, and advocate contacts."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    res = await async_client.post(
        "/api/v1/legal/ask-me",
        json={
            "query": "My cheque of 50000 bounced due to insufficient funds and I received a bank return memo",
            "preferred_language": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()

    assert data["sources_found"] is True
    assert len(data["applicable_provisions"]) >= 1
    assert data["applicable_provisions"][0]["citation_index"] == 1
    assert "[1]" in data["brief_answer"]
    assert data["spoken_summary"]
    assert "[1]" not in data["spoken_summary"]
    assert any("138" in (p["section_or_article"] or "") for p in data["applicable_provisions"])
    assert data["simplified_answer"].startswith("In simple words:")
    assert len(data["solutions"]) >= 1
    assert data["is_serious"] is True
    assert len(data["advocate_contacts"]) >= 1
    first_adv = data["advocate_contacts"][0]
    assert first_adv["phone"]
    assert first_adv["qualifications"]
    assert first_adv["bar_council_id"]


@pytest.mark.asyncio
async def test_ask_me_no_false_law_on_unknown_topic(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Ensure Ask Me never fabricates a section or article when no verified source matches."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    res = await async_client.post(
        "/api/v1/legal/ask-me",
        json={"query": "Can I register a lunar mining colony under Mars municipal bylaws?"},
    )
    assert res.status_code == 200
    data = res.json()

    assert data["sources_found"] is False
    assert data["applicable_provisions"] == []
    assert "not" in data["simplified_answer"].lower()


@pytest.mark.asyncio
async def test_ask_me_multi_turn_history_and_follow_ups(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify multi-turn history carries prior statutory context and returns smart follow-up questions."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    res = await async_client.post(
        "/api/v1/legal/ask-me",
        json={
            "query": "What if 30 days already passed since the bank return memo?",
            "preferred_language": "en",
            "history": [
                {
                    "role": "user",
                    "content": "My cheque of 120000 bounced due to insufficient funds.",
                },
                {
                    "role": "assistant",
                    "content": "Under Section 138 of the Negotiable Instruments Act, 1881, you must send notice within 30 days.",
                },
            ],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sources_found"] is True
    assert len(data["follow_up_questions"]) >= 2


@pytest.mark.asyncio
async def test_ask_me_stream_sse_events(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify /api/v1/legal/ask-me/stream emits meta, delta, and done SSE events."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    res = await async_client.post(
        "/api/v1/legal/ask-me/stream",
        json={"query": "My cheque bounced for insufficient funds"},
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers.get("content-type", "")
    body = res.text
    assert "event: meta" in body
    assert "event: delta" in body
    assert "event: done" in body


@pytest.mark.asyncio
async def test_ask_me_gemini_stt_and_tts_endpoints(
    async_client: AsyncClient, monkeypatch
):
    """Verify /api/v1/legal/ask-me/transcribe and /speak endpoints."""
    from app.modules.legal_assistant.service import LegalAssistantService

    monkeypatch.setattr(
        LegalAssistantService,
        "transcribe_audio_gemini",
        classmethod(lambda cls, audio_bytes, mime_type, language="en": "My cheque bounced yesterday"),
    )
    monkeypatch.setattr(
        LegalAssistantService,
        "synthesize_speech_gemini",
        classmethod(lambda cls, text, language="en": (b"RIFF....WAVEfmt ", "audio/wav")),
    )

    stt_res = await async_client.post(
        "/api/v1/legal/ask-me/transcribe",
        files={"file": ("voice.webm", b"fake-audio-bytes", "audio/webm")},
        data={"language": "en"},
    )
    assert stt_res.status_code == 200
    assert stt_res.json()["transcript"] == "My cheque bounced yesterday"
    assert stt_res.json()["provider"] == "gemini"

    tts_res = await async_client.post(
        "/api/v1/legal/ask-me/speak",
        json={"text": "Under Section 138 of the Negotiable Instruments Act.", "language": "en"},
    )
    assert tts_res.status_code == 200
    assert tts_res.headers["content-type"].startswith("audio/wav")
    assert tts_res.content.startswith(b"RIFF")
