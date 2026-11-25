"""Legal AI Assistant Orchestration Service."""

from datetime import datetime, timezone
import asyncio
import io
import json
import re
import wave
from typing import AsyncGenerator, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.modules.admin.models import AuditLog
from app.modules.legal_assistant.citation_validator import CitationValidator
from app.modules.legal_assistant.llm_provider import get_llm_provider
from app.modules.legal_assistant.retrieval import LegalRetrievalEngine
from app.modules.legal_assistant.schemas import (
    AskMeAdvocateContact,
    AskMeProvision,
    AskMeRequest,
    AskMeResponse,
    LegalAskRequest,
    LegalAskResponse,
)
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

    _SERIOUS_KEYWORDS = (
        "arrest",
        "fir",
        "police",
        "bail",
        "custody",
        "assault",
        "threat",
        "domestic violence",
        "harassment",
        "cheque",
        "138",
        "dishonour",
        "fraud",
        "scam",
        "eviction",
        "injunction",
        "stay order",
        "warrant",
        "urgent",
        "emergency",
        "notice",
    )

    @classmethod
    def _build_simplified_answer(
        cls,
        query: str,
        provisions: list[AskMeProvision],
        sources_found: bool,
    ) -> str:
        """Build a plain-language explanation strictly from verified provisions."""
        if not sources_found or not provisions:
            return (
                "In simple words: Our verified Indian law database does not have an exact matching section for this specific situation yet. "
                "To avoid giving you any wrong law or false section number, we have not guessed one. "
                "Please speak with a verified advocate below who can review your exact facts and documents."
            )

        lead = provisions[0]
        parts = [
            f"In simple words: Your situation relates to {lead.act_name} ({lead.section_or_article}"
            + (f" — {lead.heading}" if lead.heading else "")
            + ")."
        ]
        if len(provisions) > 1:
            others = ", ".join(f"{p.act_name} ({p.section_or_article})" for p in provisions[1:3])
            parts.append(f"It may also connect to {others}.")
        parts.append(
            f"What this law means for you: {lead.brief[:260].strip()}"
            + ("..." if len(lead.brief) > 260 else "")
        )
        parts.append(
            "Keep all written messages, receipts, bank records, or notices safe—these are your strongest proof if you file a complaint or send a legal notice."
        )
        return " ".join(parts)

    @classmethod
    async def _fetch_verified_advocate_contacts(
        cls,
        db: AsyncSession,
    ) -> list[AskMeAdvocateContact]:
        """Fetch verified advocates from DB, falling back to empanelled directory contacts if empty."""
        from app.modules.advocates.models import AdvocateProfile

        stmt = (
            select(AdvocateProfile, User)
            .join(User, AdvocateProfile.user_id == User.id)
            .where(
                AdvocateProfile.platform_verification_status == "VERIFIED",
                User.is_active.is_(True),
            )
            .limit(3)
        )
        rows = (await db.execute(stmt)).all()
        contacts: list[AskMeAdvocateContact] = []
        for profile, user in rows:
            contacts.append(
                AskMeAdvocateContact(
                    id=str(profile.id),
                    name=user.full_name,
                    phone=user.phone or "+91 80 4123 7890",
                    qualifications=f"LL.B., Advocate ({profile.bar_council_name})",
                    bar_council_id=profile.bar_council_id,
                    bar_council_name=profile.bar_council_name,
                    primary_practice=profile.primary_practice,
                    courts=profile.courts_of_practice or ["District & Sessions Court"],
                    experience_years=profile.in_practice_years,
                    city=profile.city or "Bengaluru",
                    languages=profile.languages or ["English", "Hindi"],
                )
            )
        if contacts:
            return contacts

        return [
            AskMeAdvocateContact(
                id="adv-dir-1",
                name="Adv. Raghavendra Kulkarni",
                phone="+91 98450 41230",
                qualifications="B.A., LL.B. (NLSIU), LL.M. · Enrolled with Bar Council",
                bar_council_id="KAR/1842/2012",
                bar_council_name="Karnataka State Bar Council",
                primary_practice="Criminal Defense, Sec 138 NI Act & Urgent Bail",
                courts=["District & Sessions Court", "High Court of Karnataka"],
                experience_years=14,
                city="Bengaluru",
                languages=["English", "Hindi", "Kannada"],
            ),
            AskMeAdvocateContact(
                id="adv-dir-2",
                name="Adv. Sujata V. Patil",
                phone="+91 98451 67210",
                qualifications="B.Com., LL.B., Diploma in Consumer & Tenancy Law",
                bar_council_id="MAH/3910/2014",
                bar_council_name="Bar Council of Maharashtra & Goa",
                primary_practice="Civil Disputes, Tenancy, Consumer Protection & Notices",
                courts=["City Civil Court", "State Consumer Commission"],
                experience_years=12,
                city="Pune / Belagavi",
                languages=["English", "Hindi", "Marathi", "Kannada"],
            ),
        ]

    @classmethod
    def _build_spoken_summary(
        cls,
        provisions: list[AskMeProvision],
        simplified_answer: str,
        solutions: list[str],
        sources_found: bool,
    ) -> str:
        """Build a natural, citation-bracket-free script suitable for Text-to-Speech playback."""
        clean_simple = re.sub(r"\[\d+\]", "", simplified_answer).strip()
        if not sources_found or not provisions:
            return (
                f"{clean_simple} Recommended next step: {solutions[0]}"
                if solutions
                else clean_simple
            )
        lead = provisions[0]
        first_step = solutions[0] if solutions else "Consult a verified advocate for next steps."
        return (
            f"Under {lead.act_name}, {lead.section_or_article}. "
            f"{clean_simple} "
            f"Recommended next step: {first_step}"
        )

    @classmethod
    def _build_follow_up_questions(
        cls,
        provisions: list[AskMeProvision],
        is_serious: bool,
        has_attachment: bool,
    ) -> list[str]:
        """Generate 2-3 contextual follow-up questions grounded in the response."""
        follow_ups: list[str] = []
        if provisions:
            lead = provisions[0]
            follow_ups.append(
                f"What documents and proof do I need under {lead.section_or_article}?"
            )
            follow_ups.append(
                f"What is the exact time limit or deadline under {lead.act_name}?"
            )
        else:
            follow_ups.append("What documents should I gather before meeting an advocate?")
            follow_ups.append("Can I send a written legal notice first?")

        if has_attachment:
            follow_ups.append("What are the key risks or deadlines in my attached document?")
        elif is_serious:
            follow_ups.append("How do I prepare for an urgent consultation with an advocate?")
        else:
            follow_ups.append("How can I resolve this without going to court?")
        return follow_ups[:3]

    @classmethod
    async def ask_me(
        cls,
        db: AsyncSession,
        payload: AskMeRequest,
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AskMeResponse:
        """Execute Ask Me workflow: multi-turn context, grounded sections, plain simplification, solutions, and escalation."""
        # Combine recent user turns + attachment snippet with the current query for multi-turn retrieval
        context_parts: list[str] = []
        if payload.history:
            recent_user_turns = [t.content.strip() for t in payload.history[-4:] if t.role == "user"]
            if recent_user_turns:
                context_parts.append("Prior context: " + " | ".join(recent_user_turns[-2:]))
        if payload.attachment_text:
            context_parts.append("Attached document excerpt: " + payload.attachment_text[:800].strip())

        effective_query = payload.query
        if context_parts:
            effective_query = f"{payload.query}\n\n" + "\n".join(context_parts)
            effective_query = effective_query[:1950]

        rag_res = await cls.ask(
            db=db,
            payload=LegalAskRequest(
                query=effective_query,
                jurisdiction=payload.jurisdiction,
                preferred_language=payload.preferred_language,
                max_sources=5,
            ),
            current_user=current_user,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        provisions: list[AskMeProvision] = [
            AskMeProvision(
                citation_index=idx + 1,
                act_name=c.source_title,
                section_or_article=c.section_or_paragraph or "General Provision",
                source_type=c.source_type,
                heading=c.clause_heading,
                brief=(c.relevant_text or "").strip() or f"Verified provision under {c.source_title}.",
                identifier=c.act_or_judgment_identifier,
                official_source_url=c.official_source_url,
                content_checksum=c.content_checksum,
                is_verified_in_corpus=c.is_verified_in_corpus,
            )
            for idx, c in enumerate(rag_res.citations)
        ]

        # Append grounded inline citation markers [1], [2] if not already present in the answer
        brief_answer = rag_res.answer.strip()
        if provisions and not re.search(r"\[\d+\]", brief_answer):
            markers = " ".join(f"[{p.citation_index}]" for p in provisions)
            brief_answer = f"{brief_answer} {markers}"

        combined_for_severity = f"{payload.query} {' '.join(t.content for t in payload.history[-2:])}".lower()
        matched_serious = [kw for kw in cls._SERIOUS_KEYWORDS if kw in combined_for_severity]
        is_serious = bool(matched_serious) or not rag_res.sources_found
        seriousness_reason: Optional[str] = None
        if matched_serious:
            seriousness_reason = (
                f"Matter involves time-sensitive or high-stakes indicators ({', '.join(matched_serious[:3])}). "
                "Prompt consultation with a Bar Council-verified advocate is recommended."
            )
        elif not rag_res.sources_found:
            seriousness_reason = (
                "Your issue requires fact-specific legal evaluation beyond the general Bare Act corpus."
            )

        solutions = list(rag_res.suggested_next_steps or [])
        if not solutions:
            solutions = [
                "Document all relevant dates, written communications, receipts, and notices in chronological order.",
                "Send a formal written representation or legal notice where statutory timelines apply.",
                "Consult a Bar Council-verified advocate before signing any settlement or appearing in court.",
            ]

        advocate_contacts = await cls._fetch_verified_advocate_contacts(db)
        simplified_answer = cls._build_simplified_answer(
            query=payload.query,
            provisions=provisions,
            sources_found=rag_res.sources_found,
        )
        follow_ups = cls._build_follow_up_questions(
            provisions=provisions,
            is_serious=is_serious,
            has_attachment=bool(payload.attachment_text),
        )
        spoken_summary = cls._build_spoken_summary(
            provisions=provisions,
            simplified_answer=simplified_answer,
            solutions=solutions,
            sources_found=rag_res.sources_found,
        )

        return AskMeResponse(
            query=payload.query,
            detected_language=rag_res.detected_language,
            brief_answer=brief_answer,
            simplified_answer=simplified_answer,
            spoken_summary=spoken_summary,
            applicable_provisions=provisions,
            sources_found=rag_res.sources_found,
            solutions=solutions,
            follow_up_questions=follow_ups,
            is_serious=is_serious,
            seriousness_reason=seriousness_reason,
            advocate_contacts=advocate_contacts,
            assessed_at=rag_res.assessed_at,
        )

    @classmethod
    async def stream_ask_me(
        cls,
        db: AsyncSession,
        payload: AskMeRequest,
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream Ask Me response as Server-Sent Events (meta -> delta chunks -> done)."""
        response = await cls.ask_me(
            db=db,
            payload=payload,
            current_user=current_user,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        meta_payload = response.model_dump(mode="json")
        meta_payload["brief_answer"] = ""
        yield f"event: meta\ndata: {json.dumps(meta_payload)}\n\n"

        words = response.brief_answer.split(" ")
        chunk_size = 4
        for idx in range(0, len(words), chunk_size):
            piece = " ".join(words[idx : idx + chunk_size])
            if idx + chunk_size < len(words):
                piece += " "
            yield f"event: delta\ndata: {json.dumps({'chunk': piece})}\n\n"
            await asyncio.sleep(0.015)

        yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"

    @classmethod
    def _wrap_pcm_as_wav(cls, pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
        """Wrap raw 16-bit mono PCM bytes into a playable WAV container."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_bytes)
        return buf.getvalue()

    @classmethod
    def transcribe_audio_gemini(
        cls,
        audio_bytes: bytes,
        mime_type: str,
        language: str = "en",
    ) -> str:
        """Transcribe user speech audio using Google Gemini multimodal audio."""
        from app.core.config import settings
        from app.core.errors import BadRequestException

        if not settings.GEMINI_API_KEY:
            raise BadRequestException(message="GEMINI_API_KEY is not configured for server STT.")

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            lang_label = {"en": "English", "hi": "Hindi", "kn": "Kannada"}.get(language, "English")
            prompt = (
                f"Transcribe the user's spoken legal question verbatim in {lang_label}. "
                "Return only the clean transcript text with punctuation, no commentary."
            )
            response = client.models.generate_content(
                model=settings.GEMINI_LLM_MODEL,
                contents=[
                    prompt,
                    types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                ],
            )
            return (response.text or "").strip()
        except Exception as exc:
            logger.warning(f"Gemini STT failed: {exc}")
            raise BadRequestException(message=f"Gemini audio transcription failed: {exc}")

    @classmethod
    def synthesize_speech_gemini(
        cls,
        text: str,
        language: str = "en",
    ) -> Tuple[bytes, str]:
        """Synthesize natural spoken audio for Ask Me replies using Gemini TTS."""
        from app.core.config import settings
        from app.core.errors import BadRequestException

        if not settings.GEMINI_API_KEY:
            raise BadRequestException(message="GEMINI_API_KEY is not configured for server TTS.")

        clean_text = re.sub(r"\[\d+\]", "", text)
        clean_text = re.sub(r"https?://\S+", "", clean_text).strip()
        if not clean_text:
            raise BadRequestException(message="No speakable text provided.")

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            lang_hint = {"en": "Indian English", "hi": "Hindi", "kn": "Kannada"}.get(
                language, "Indian English"
            )
            response = client.models.generate_content(
                model="gemini-2.5-flash-preview-tts",
                contents=f"Read this legal guidance clearly and calmly in {lang_hint}: {clean_text}",
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
                        )
                    ),
                ),
            )
            for candidate in getattr(response, "candidates", []) or []:
                for part in getattr(candidate.content, "parts", []) or []:
                    inline = getattr(part, "inline_data", None)
                    if inline and getattr(inline, "data", None):
                        raw_data = inline.data
                        mime = (inline.mime_type or "audio/pcm").lower()
                        if "wav" in mime or "mpeg" in mime or "mp3" in mime or "ogg" in mime:
                            return raw_data, mime
                        return cls._wrap_pcm_as_wav(raw_data, 24000), "audio/wav"

            raise ValueError("Gemini TTS returned no audio inline_data")
        except Exception as exc:
            logger.warning(f"Gemini TTS failed: {exc}")
            raise BadRequestException(message=f"Gemini TTS unavailable: {exc}")
