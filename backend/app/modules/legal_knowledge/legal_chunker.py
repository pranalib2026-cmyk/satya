"""Structure-Aware Legal Chunker for Indian Statutory Bare Acts and Judgments.

Splits statutes strictly along Chapter, Section, Subsection, and Schedule boundaries.
Never fractures legal provisions arbitrarily; preserves legislative identifiers and context.
"""

from dataclasses import dataclass, field
import hashlib
import re
from typing import Any, Dict, List, Optional


@dataclass
class ParsedLegalChunk:
    """A structurally parsed statutory section or schedule chunk with full legislative lineage."""

    section_number: str
    clause_heading: Optional[str]
    chunk_text: str
    chapter: Optional[str] = None
    subsections: List[str] = field(default_factory=list)
    token_count: int = 0
    content_checksum: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "section_number": self.section_number,
            "clause_heading": self.clause_heading,
            "chunk_text": self.chunk_text,
            "chapter": self.chapter,
            "subsections": self.subsections,
            "token_count": self.token_count,
            "content_checksum": self.content_checksum,
            "metadata": self.metadata,
        }


class LegalChunker:
    """Indian statutory section parser and structural chunker."""

    # Patterns matching Chapters and Parts
    CHAPTER_PATTERN = re.compile(
        r"(?:^|\n)\s*(CHAPTER\s+[IVXLCDM\d]+[A-Z]?|PART\s+[IVXLCDM\d]+[A-Z]?)\s*[:.\-–—]?\s*([^\n]+)?",
        re.IGNORECASE,
    )

    # Patterns matching Statutory Sections
    # Examples:
    # "Section 138. Dishonour of cheque for insufficiency..."
    # "138. Dishonour of cheque..."
    # "Section 25F - Conditions precedent to retrenchment..."
    # "Article 54. For specific performance..."
    SECTION_HEADER_PATTERN = re.compile(
        r"(?:^|\n)\s*(?:(?:Section|Sec\.|Article)\s+)?(\d+[A-Z]?(?:\([a-zA-Z0-9]+\))?)\.\s*([^\n\(\d]+(?:\([^\)]+\))?[^\n]*)",
        re.IGNORECASE,
    )

    # Alternative pattern: "Section 138 - Heading" or "Section 138: Heading"
    SECTION_HEADER_ALT_PATTERN = re.compile(
        r"(?:^|\n)\s*(Section\s+\d+[A-Z]?(?:\([a-zA-Z0-9]+\))?|Article\s+\d+[A-Z]?)\s*[-:–—]\s*([^\n]+)",
        re.IGNORECASE,
    )

    # Schedule pattern
    SCHEDULE_PATTERN = re.compile(
        r"(?:^|\n)\s*(THE\s+(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|\d+(?:ST|ND|RD|TH)?)\s+SCHEDULE|SCHEDULE\s+[IVXLCDM\d]+)\s*[:.\-–—]?\s*([^\n]+)?",
        re.IGNORECASE,
    )

    # Subsection pattern e.g. (1), (2), (a), (b), (i), (ii)
    SUBSECTION_PATTERN = re.compile(r"(?:^|\n|\s)(\(\d+\)|\([a-zA-Z]\)|\([ivx]+\))")

    @classmethod
    def chunk_statute_text(
        cls,
        text: str,
        act_title: str,
        jurisdiction: str = "Union of India",
        document_version: str = "1.0",
        short_code: Optional[str] = None,
    ) -> List[ParsedLegalChunk]:
        """Split a complete Bare Act text into distinct, grounded statutory section chunks."""
        if not text or not text.strip():
            return []

        chunks: List[ParsedLegalChunk] = []
        current_chapter: Optional[str] = None

        # 1. Identify all structural candidate split points
        # We split text into raw blocks by scanning for Section headers
        lines = text.split("\n")
        section_blocks: List[Dict[str, Any]] = []

        active_sec_num: Optional[str] = None
        active_heading: Optional[str] = None
        active_lines: List[str] = []

        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                if active_lines:
                    active_lines.append("")
                continue

            # Check if this line is a Chapter header
            chap_match = cls.CHAPTER_PATTERN.match(line)
            if chap_match:
                chap_name = chap_match.group(1).strip()
                chap_title = (chap_match.group(2) or "").strip()
                current_chapter = f"{chap_name}: {chap_title}" if chap_title else chap_name
                continue

            # Check if this line is a Schedule header
            sched_match = cls.SCHEDULE_PATTERN.match(line)
            if sched_match:
                if active_sec_num and active_lines:
                    section_blocks.append({
                        "section_number": active_sec_num,
                        "clause_heading": active_heading,
                        "chapter": current_chapter,
                        "body": "\n".join(active_lines).strip(),
                    })
                    active_lines = []
                sched_name = sched_match.group(1).strip()
                sched_title = (sched_match.group(2) or "").strip()
                active_sec_num = sched_name
                active_heading = sched_title or "Schedule"
                continue

            # Check Section match
            sec_match = cls.SECTION_HEADER_ALT_PATTERN.match(line)
            if not sec_match:
                sec_match = cls.SECTION_HEADER_PATTERN.match(line)

            if sec_match:
                # Save previous section if open
                if active_sec_num:
                    body_text = "\n".join(active_lines).strip()
                    if not body_text and active_heading:
                        body_text = active_heading
                    if body_text:
                        section_blocks.append({
                            "section_number": active_sec_num,
                            "clause_heading": active_heading,
                            "chapter": current_chapter,
                            "body": body_text,
                        })
                    active_lines = []

                raw_num = sec_match.group(1).strip()
                # Ensure canonical 'Section X' prefix
                if not raw_num.lower().startswith(("section", "article", "the schedule", "schedule")):
                    sec_num = f"Section {raw_num}"
                else:
                    sec_num = raw_num

                heading = (sec_match.group(2) or "").strip()
                active_sec_num = sec_num
                active_heading = heading or None
            else:
                if active_sec_num is not None:
                    active_lines.append(line)

        # Flush final section
        if active_sec_num:
            body_text = "\n".join(active_lines).strip()
            if not body_text and active_heading:
                body_text = active_heading
            if body_text:
                section_blocks.append({
                    "section_number": active_sec_num,
                    "clause_heading": active_heading,
                    "chapter": current_chapter,
                    "body": body_text,
                })

        # Fallback if text didn't match typical Section regex (e.g., short excerpt or judgment)
        if not section_blocks and text.strip():
            section_blocks.append({
                "section_number": "Section 1",
                "clause_heading": act_title,
                "chapter": current_chapter,
                "body": text.strip(),
            })

        # 2. Convert section blocks into validated ParsedLegalChunks
        for block in section_blocks:
            body = block["body"]
            sec_num = block["section_number"]
            heading = block["clause_heading"]
            chap = block["chapter"]

            # If the body itself is empty, skip
            if not body or len(body) < 10:
                continue

            # Extract detected subsections
            subsections = cls.SUBSECTION_PATTERN.findall(body)

            # If section is excessively long (>4500 chars), split cleanly on subsection boundaries
            # rather than arbitrary character slicing, keeping section header on each chunk
            if len(body) > 4500 and len(subsections) > 1:
                sub_chunks = cls._split_long_section_by_subsections(
                    body=body,
                    section_number=sec_num,
                    heading=heading,
                    chapter=chap,
                    act_title=act_title,
                    jurisdiction=jurisdiction,
                    document_version=document_version,
                    short_code=short_code,
                )
                chunks.extend(sub_chunks)
            else:
                token_est = int(len(re.findall(r"\w+", body)) * 1.3)
                checksum = hashlib.sha256(body.encode("utf-8")).hexdigest()

                meta = {
                    "act_title": act_title,
                    "jurisdiction": jurisdiction,
                    "document_version": document_version,
                    "short_code": short_code,
                    "chapter": chap,
                    "subsections": subsections,
                }

                chunk = ParsedLegalChunk(
                    section_number=sec_num,
                    clause_heading=heading,
                    chunk_text=body,
                    chapter=chap,
                    subsections=subsections,
                    token_count=token_est,
                    content_checksum=checksum,
                    metadata=meta,
                )
                chunks.append(chunk)

        return chunks

    @classmethod
    def _split_long_section_by_subsections(
        cls,
        body: str,
        section_number: str,
        heading: Optional[str],
        chapter: Optional[str],
        act_title: str,
        jurisdiction: str,
        document_version: str,
        short_code: Optional[str],
    ) -> List[ParsedLegalChunk]:
        """Split a long section along subsection boundaries while preserving legislative context."""
        parts = re.split(r"(?:\n|\s)(?=\(\d+\)|\([a-zA-Z]\))", body)
        results: List[ParsedLegalChunk] = []

        current_text = ""
        current_sub = ""

        for part in parts:
            if not part.strip():
                continue

            # Check if this part starts with a subsection identifier
            sub_match = re.match(r"^\((\d+|[a-zA-Z]|[ivx]+)\)", part.strip())
            sub_id = sub_match.group(0) if sub_match else ""

            if len(current_text) + len(part) > 2500 and current_text:
                token_est = int(len(re.findall(r"\w+", current_text)) * 1.3)
                checksum = hashlib.sha256(current_text.encode("utf-8")).hexdigest()
                sec_label = f"{section_number} {current_sub}".strip()

                results.append(
                    ParsedLegalChunk(
                        section_number=sec_label,
                        clause_heading=heading,
                        chunk_text=current_text.strip(),
                        chapter=chapter,
                        subsections=[current_sub] if current_sub else [],
                        token_count=token_est,
                        content_checksum=checksum,
                        metadata={
                            "act_title": act_title,
                            "jurisdiction": jurisdiction,
                            "document_version": document_version,
                            "short_code": short_code,
                            "chapter": chapter,
                            "is_subpart": True,
                        },
                    )
                )
                current_text = part
                current_sub = sub_id
            else:
                if not current_text:
                    current_sub = sub_id
                current_text = f"{current_text}\n{part}".strip()

        if current_text:
            token_est = int(len(re.findall(r"\w+", current_text)) * 1.3)
            checksum = hashlib.sha256(current_text.encode("utf-8")).hexdigest()
            sec_label = f"{section_number} {current_sub}".strip()

            results.append(
                ParsedLegalChunk(
                    section_number=sec_label,
                    clause_heading=heading,
                    chunk_text=current_text.strip(),
                    chapter=chapter,
                    subsections=[current_sub] if current_sub else [],
                    token_count=token_est,
                    content_checksum=checksum,
                    metadata={
                        "act_title": act_title,
                        "jurisdiction": jurisdiction,
                        "document_version": document_version,
                        "short_code": short_code,
                        "chapter": chapter,
                        "is_subpart": True,
                    },
                )
            )

        return results

    @classmethod
    def chunk_judgment_text(
        cls,
        text: str,
        case_title: str,
        jurisdiction: str = "Union of India",
        court: Optional[str] = None,
        decision_date: Optional[str] = None,
        citation: Optional[str] = None,
        document_version: str = "1.0",
        max_chars: int = 2400,
    ) -> List[ParsedLegalChunk]:
        """Split a judicial decision into paragraph-boundary-aware chunks preserving case lineage."""
        if not text or not text.strip():
            return []

        paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", text.strip()) if p.strip()]
        if not paragraphs:
            paragraphs = [text.strip()]

        # Further split oversized single paragraphs along numbered sentences/lines
        normalized_paras: List[str] = []
        for para in paragraphs:
            if len(para) <= max_chars:
                normalized_paras.append(para)
            else:
                lines = [ln.strip() for ln in para.splitlines() if ln.strip()]
                buf = ""
                for ln in lines:
                    if len(buf) + len(ln) + 1 > max_chars and buf:
                        normalized_paras.append(buf)
                        buf = ln
                    else:
                        buf = f"{buf}\n{ln}".strip() if buf else ln
                if buf:
                    if len(buf) <= max_chars:
                        normalized_paras.append(buf)
                    else:
                        for i in range(0, len(buf), max_chars):
                            normalized_paras.append(buf[i : i + max_chars].strip())

        grouped_blocks: List[str] = []
        current_buf = ""
        for para in normalized_paras:
            if len(current_buf) + len(para) + 2 > max_chars and current_buf:
                grouped_blocks.append(current_buf)
                current_buf = para
            else:
                current_buf = f"{current_buf}\n\n{para}".strip() if current_buf else para
        if current_buf:
            grouped_blocks.append(current_buf)

        chunks: List[ParsedLegalChunk] = []
        total = len(grouped_blocks)
        for idx, block in enumerate(grouped_blocks, start=1):
            if len(block) < 15:
                continue
            para_match = re.match(r"^(?:Para(?:graph)?\.?\s*)?(\d+)\.", block, re.IGNORECASE)
            sec_label = f"Para {para_match.group(1)}" if para_match else (
                "Judgment Summary" if total == 1 else f"Part {idx} of {total}"
            )
            token_est = int(len(re.findall(r"\w+", block)) * 1.3)
            checksum = hashlib.sha256(block.encode("utf-8")).hexdigest()
            chunks.append(
                ParsedLegalChunk(
                    section_number=sec_label,
                    clause_heading=case_title[:255],
                    chunk_text=block,
                    chapter=court,
                    subsections=[],
                    token_count=token_est,
                    content_checksum=checksum,
                    metadata={
                        "case_title": case_title,
                        "jurisdiction": jurisdiction,
                        "court": court,
                        "decision_date": decision_date,
                        "citation": citation,
                        "document_version": document_version,
                        "part_index": idx,
                        "total_parts": total,
                    },
                )
            )
        return chunks

    @classmethod
    def chunk_policy_scheme(
        cls,
        scheme_name: str,
        scheme_slug: str,
        sections: List[Dict[str, str]],
        jurisdiction: str = "Union of India",
        ministry_or_state: Optional[str] = None,
        official_url: Optional[str] = None,
        document_version: str = "2026.1",
        max_chars: int = 2800,
    ) -> List[ParsedLegalChunk]:
        """Chunk a government policy/scheme along logical sections (Overview, Eligibility, Benefits, Process)."""
        # First normalize/sub-split any single section exceeding max_chars along paragraph boundaries
        expanded_sections: List[Dict[str, str]] = []
        for sec in sections:
            label = (sec.get("label") or "").strip()
            body = (sec.get("text") or "").strip()
            if not body:
                continue
            if len(body) + len(label) + 4 <= max_chars:
                expanded_sections.append({"label": label, "text": body})
            else:
                paras = [p.strip() for p in re.split(r"\n+", body) if p.strip()]
                part_buf = ""
                for p in paras:
                    if len(part_buf) + len(p) + 1 > max_chars and part_buf:
                        expanded_sections.append({"label": label, "text": part_buf})
                        part_buf = p
                    elif len(p) > max_chars:
                        if part_buf:
                            expanded_sections.append({"label": label, "text": part_buf})
                            part_buf = ""
                        for i in range(0, len(p), max_chars):
                            expanded_sections.append({"label": label, "text": p[i : i + max_chars].strip()})
                    else:
                        part_buf = f"{part_buf}\n{p}".strip() if part_buf else p
                if part_buf:
                    expanded_sections.append({"label": label, "text": part_buf})

        grouped: List[Dict[str, str]] = []
        buf_label = ""
        buf_text = ""

        for sec in expanded_sections:
            label = sec["label"]
            body = sec["text"]
            entry = f"{label}:\n{body}" if label else body
            if len(buf_text) + len(entry) + 2 > max_chars and buf_text:
                grouped.append({"label": buf_label or label, "text": buf_text})
                buf_label = label
                buf_text = entry
            else:
                buf_label = f"{buf_label} & {label}".strip(" &") if buf_label and label else (buf_label or label)
                buf_text = f"{buf_text}\n\n{entry}".strip() if buf_text else entry

        if buf_text:
            grouped.append({"label": buf_label or "Scheme Details", "text": buf_text})

        chunks: List[ParsedLegalChunk] = []
        for idx, blk in enumerate(grouped, start=1):
            text_body = blk["text"]
            token_est = int(len(re.findall(r"\w+", text_body)) * 1.3)
            checksum = hashlib.sha256(text_body.encode("utf-8")).hexdigest()
            sec_num = f"Scheme: {scheme_slug}" if len(grouped) == 1 else f"Scheme: {scheme_slug} ({idx}/{len(grouped)})"
            chunks.append(
                ParsedLegalChunk(
                    section_number=sec_num[:64],
                    clause_heading=f"{scheme_name[:200]} — {blk['label'][:50]}"[:255],
                    chunk_text=text_body,
                    chapter=ministry_or_state,
                    subsections=[],
                    token_count=token_est,
                    content_checksum=checksum,
                    metadata={
                        "scheme_name": scheme_name,
                        "scheme_slug": scheme_slug,
                        "jurisdiction": jurisdiction,
                        "ministry_or_state": ministry_or_state,
                        "official_url": official_url,
                        "document_version": document_version,
                    },
                )
            )
        return chunks
