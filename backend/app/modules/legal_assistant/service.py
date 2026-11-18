"""Legal AI Assistant Orchestration Service."""

from datetime import datetime, timezone
import re
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.modules.admin.models import AuditLog
from app.modules.legal_assistant.citation_validator import CitationValidator
from app.modules.legal_assistant.llm_provider import get_llm_provider
from app.modules.legal_assistant.retrieval import LegalRetrievalEngine
from app.modules.legal_assistant.schemas import LegalAskRequest, LegalAskResponse
from app.modules.legal_knowledge.ingestion import LegalIngestionService
from app.modules.legal_knowledge.models import LegalChunk
from app.modules.users.models import User


class LegalAssistantService:
    """End-to-end RAG orchestrator for grounded legal question answering."""

    @staticmethod
    def detect_language(query: str, preferred: str = "en") -> str:
        """Identify question language: English, Hindi, or Kannada."""
        # Devanagari Unicode block (0900-097F) -> Hindi / Marathi
        if re.search(r"[\u0900-\u097F]", query):
            return "hi"
        # Kannada Unicode block (0C80-0CFF) -> Kannada
        if re.search(r"[\u0C80-\u0CFF]", query):
            return "kn"
        if preferred in ["hi", "kn"]:
            return preferred
        return "en"

    @classmethod
    async def ask(
        cls,
        db: AsyncSession,
        payload: LegalAskRequest,
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> LegalAskResponse:
        """Execute grounded legal question answering workflow."""
        # 1. Ensure initial curated statutory corpus is seeded
        chunk_count_res = await db.execute(select(func.count(LegalChunk.id)))
        total_chunks = chunk_count_res.scalar() or 0
        if total_chunks == 0:
            await LegalIngestionService.seed_curated_corpus(db)

        # 2. Identify question language
        detected_lang = cls.detect_language(payload.query, payload.preferred_language)

        # 3. Retrieve relevant legal chunks using hybrid vector + keyword retrieval
        retrieved_chunks = await LegalRetrievalEngine.retrieve(
            db=db,
            query=payload.query,
            jurisdiction=payload.jurisdiction,
            max_sources=payload.max_sources,
        )

        # 4. Generate structured grounded answer via LLM Provider
        llm = get_llm_provider()
        llm_output = llm.generate_legal_answer(
            query=payload.query,
            retrieved_chunks=retrieved_chunks,
            language=detected_lang,
        )

        # 5. Validate citations strictly against retrieved context
        raw_claimed_refs = llm_output.get("cited_references", [])
        verified_citations, unverified_pruned = CitationValidator.validate_and_filter_citations(
            answer_text=llm_output.get("answer", ""),
            claimed_references=raw_claimed_refs,
            retrieved_chunks=retrieved_chunks,
        )

        sources_found = llm_output.get("sources_found", False) and len(verified_citations) > 0

        # 6. Audit Query & Response
        audit = AuditLog(
            actor_id=current_user.id if current_user else None,
            action="LEGAL_AI_QUERY_ANSWERED",
            entity_type="legal_assistant_rag",
            entity_id=None,
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "query": payload.query[:200],
                "language": detected_lang,
                "jurisdiction": payload.jurisdiction,
                "retrieved_count": len(retrieved_chunks),
                "citations_verified_count": len(verified_citations),
                "unverified_detected": unverified_pruned,
                "sources_found": sources_found,
            },
        )
        db.add(audit)
        await db.commit()

        logger.info(
            f"Legal Assistant query answered: lang={detected_lang} retrieved={len(retrieved_chunks)} verified_citations={len(verified_citations)}"
        )

        return LegalAskResponse(
            query=payload.query,
            detected_language=detected_lang,
            answer=llm_output.get("answer", ""),
            sources_found=sources_found,
            citations=verified_citations,
            unverified_citations_detected=unverified_pruned,
            suggested_next_steps=llm_output.get("suggested_next_steps", []),
            retrieved_chunks_count=len(retrieved_chunks),
            assessed_at=datetime.now(timezone.utc),
        )
