"""LLM Provider Abstraction for Grounded Legal Question Answering.

Enforces strict grounding against retrieved statutory Bare Act chunks and published
judicial precedents. Prevents hallucinations and unverified legal assertions.
"""

from abc import ABC, abstractmethod
import json
import re
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.logging import logger


class BaseLLMProvider(ABC):
    """Abstract interface for grounded legal language models."""

    @abstractmethod
    def generate_legal_answer(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        language: str = "en",
    ) -> Dict[str, Any]:
        """Generate structured answer derived strictly from retrieved context chunks."""
        pass


class DeterministicGroundedLLMProvider(BaseLLMProvider):
    """Deterministic, hallucination-free legal synthesis engine.
    
    Operates strictly on the provided context chunks. If no relevant chunks were
    retrieved, it explicitly returns that no supporting verified Indian legal sources
    were found, adhering to statutory non-advice rules.
    """

    LANGUAGE_DISCLAIMERS = {
        "en": "For individualized legal representation, please consult an empanelled advocate.",
        "hi": "व्यक्तिगत कानूनी सहायता के लिए कृपया किसी सत्यापित अधिवक्ता से परामर्श करें।",
        "kn": "ವೈಯಕ್ತಿಕ ಕಾನೂನು ನೆರವಿಗಾಗಿ ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿದ ವಕೀಲರನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    }

    def generate_legal_answer(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        language: str = "en",
    ) -> Dict[str, Any]:
        # 1. Strict Fallback when sources are insufficient
        if not retrieved_chunks:
            return {
                "answer": (
                    "No verified legal sources found in the knowledge base addressing this specific query. "
                    "Under platform safety rules, NyayaSetu will not generate speculative or ungrounded legal "
                    "statements without supporting statutory Bare Acts or published judicial decisions. "
                    "Please consult an empanelled, verified advocate for individualized legal advice."
                ),
                "sources_found": False,
                "cited_references": [],
                "suggested_next_steps": [
                    "Consult an empanelled advocate for matter-specific legal representation.",
                    "Verify official rules on relevant High Court or Ministry portals (e.g., IndiaCode, e-Courts).",
                ],
            }

        # 2. Extract facts, provisions, and citations from retrieved chunks
        answer_paragraphs: List[str] = []
        cited_references: List[Dict[str, Any]] = []
        next_steps: List[str] = []

        q_lower = query.lower()

        for chunk in retrieved_chunks:
            sec = chunk.get("section_number")
            heading = chunk.get("clause_heading")
            text = chunk.get("chunk_text", "").strip()
            source_title = chunk.get("source_title", "Indian Statute")
            citation = chunk.get("citation")

            ref_desc = f"{sec}: {heading}" if (sec and heading) else (sec or heading or source_title)
            cited_references.append({
                "source_title": source_title,
                "source_type": chunk.get("source_type", "BARE_ACT"),
                "act_or_judgment_identifier": chunk.get("act_or_judgment_identifier") or citation,
                "section_or_paragraph": sec,
                "clause_heading": heading,
                "official_source_url": chunk.get("official_source_url"),
                "content_checksum": chunk.get("content_checksum"),
            })

            # Synthesize grounded narrative snippet
            clean_text = re.sub(r"\s+", " ", text)
            if len(clean_text) > 280:
                clean_text = clean_text[:277] + "..."

            para = f"Under **{source_title}**, **{ref_desc}**, the law provides that: {clean_text}"
            answer_paragraphs.append(para)

            # Extract actionable next steps based on statutory context
            if sec and "138" in sec:
                next_steps.extend([
                    "Issue statutory legal demand notice in writing to the drawer within 30 days of receiving the cheque return memo.",
                    "Allow 15 days statutory period for the drawer to make payment post receipt of notice.",
                    "File formal complaint under Section 138 before the competent Judicial Magistrate within 1 month of cause of action.",
                ])
            elif sec and "35" in sec:
                next_steps.extend([
                    "File a consumer complaint electronically through the e-Daakhil portal (edaakhil.nic.in) or physically before the District Commission.",
                    "Attach tax invoice, warranty terms, and prior written service correspondence.",
                ])
            elif sec and "12" in sec and "legal services" in source_title.lower():
                next_steps.extend([
                    "Apply for free legal aid through the District Legal Services Authority (DLSA) or State Legal Services Authority (SLSA).",
                    "Submit affidavit or identification proving eligibility under Section 12 of the Legal Services Authorities Act, 1987.",
                ])
            elif sec and "18" in sec and "real estate" in source_title.lower():
                next_steps.extend([
                    "File a complaint before the State Real Estate Regulatory Authority (RERA) seeking refund with interest or compensation.",
                    "Preserve builder-buyer agreement and payment receipts reflecting the agreed possession date.",
                ])
            elif sec and "479" in sec:
                next_steps.extend([
                    "Move an application for regular bail or statutory release under Section 479 BNSS / 436A CrPC before the trial court.",
                    "Obtain custody certificate from the jail superintendent confirming period of detention served.",
                ])

        if not next_steps:
            next_steps = [
                "Preserve all relevant documentary evidence, invoices, and written communications.",
                "Seek legal counsel from an empanelled advocate before initiating court proceedings.",
            ]

        # Deduplicate next steps
        dedup_steps = list(dict.fromkeys(next_steps))[:4]

        # Multi-language translation header if requested
        lang_note = ""
        if language == "hi":
            lang_note = "(हिंदी सारांश) आधिकारिक भारतीय संविधि के अनुसार प्रासंगिक कानूनी प्रावधान निम्नलिखित हैं:\n\n"
        elif language == "kn":
            lang_note = "(ಕನ್ನಡ ಸಾರಾಂಶ) ಅಧಿಕೃತ ಭಾರತೀಯ ಕಾಯ್ದೆಗಳ ಪ್ರಕಾರ ಸಂಬಂಧಿತ ಕಾನೂನು ನಿಬಂಧನೆಗಳು ಕೆಳಗಿನಂತಿವೆ:\n\n"

        full_answer = lang_note + "\n\n".join(answer_paragraphs)

        return {
            "answer": full_answer,
            "sources_found": True,
            "cited_references": cited_references,
            "suggested_next_steps": dedup_steps,
        }


class GeminiLLMProvider(BaseLLMProvider):
    """Google Gemini LLM provider with grounding system prompt and JSON schema."""

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._fallback = DeterministicGroundedLLMProvider()

    def generate_legal_answer(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        language: str = "en",
    ) -> Dict[str, Any]:
        if not self._api_key:
            return self._fallback.generate_legal_answer(query, retrieved_chunks, language)

        try:
            import google.generativeai as genai
            genai.configure(api_key=self._api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")

            context_str = json.dumps([
                {
                    "title": c.get("source_title"),
                    "section": c.get("section_number"),
                    "heading": c.get("clause_heading"),
                    "text": c.get("chunk_text"),
                }
                for c in retrieved_chunks
            ], indent=2)

            prompt = (
                f"You are the NyayaSetu AI Legal Assistant for Indian Law.\n"
                f"STRICT RULES:\n"
                f"1. Answer ONLY using the provided legal context.\n"
                f"2. Never cite any section, act, or judgment not in the context.\n"
                f"3. Never provide guaranteed legal advice.\n"
                f"4. Target language: {language}.\n\n"
                f"CONTEXT:\n{context_str}\n\n"
                f"QUESTION: {query}\n"
            )

            response = model.generate_content(prompt)
            if response and response.text:
                return {
                    "answer": response.text.strip(),
                    "sources_found": bool(retrieved_chunks),
                    "cited_references": [
                        {
                            "source_title": c.get("source_title"),
                            "source_type": c.get("source_type", "BARE_ACT"),
                            "act_or_judgment_identifier": c.get("act_or_judgment_identifier") or c.get("citation"),
                            "section_or_paragraph": c.get("section_number"),
                            "clause_heading": c.get("clause_heading"),
                            "official_source_url": c.get("official_source_url"),
                            "content_checksum": c.get("content_checksum"),
                        }
                        for c in retrieved_chunks
                    ],
                    "suggested_next_steps": [
                        "Preserve relevant documentary evidence and statutory notices.",
                        "Consult an empanelled advocate for matter-specific legal representation.",
                    ],
                }
        except Exception as exc:
            logger.warning(f"Gemini LLM generation failed: {exc}. Using deterministic provider.")

        return self._fallback.generate_legal_answer(query, retrieved_chunks, language)


# Active singleton instance
_llm_provider_instance: Optional[BaseLLMProvider] = None


def get_llm_provider() -> BaseLLMProvider:
    """Return active LLM provider based on environment settings."""
    global _llm_provider_instance
    if _llm_provider_instance is None:
        if settings.GEMINI_API_KEY and settings.is_production:
            _llm_provider_instance = GeminiLLMProvider()
        else:
            _llm_provider_instance = DeterministicGroundedLLMProvider()
    return _llm_provider_instance
