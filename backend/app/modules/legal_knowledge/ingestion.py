"""Legal Document Ingestion and Chunking Engine.

Extracts, structures, hashes (SHA-256), embeds, and stores verified Indian Bare Acts
and landmark judicial decisions into PostgreSQL with pgvector.
"""

import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple, Union
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logging import logger
from app.modules.legal_assistant.embedding_provider import get_embedding_provider
from app.modules.legal_assistant.schemas import LegalChunkCreate, LegalSourceCreate
from app.modules.legal_knowledge.models import LegalChunk, LegalIngestionJob, LegalSource
from app.modules.legal_knowledge.seed_data import CURATED_LEGAL_SOURCES


def compute_sha256(text: str) -> str:
    """Compute standard SHA-256 hexadecimal digest for content verification."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class LegalIngestionService:
    """Administrative service for ingesting curated Indian legal sources and generating vector chunks."""

    @classmethod
    async def seed_curated_corpus(cls, db: AsyncSession) -> int:
        """Seed the curated Bare Acts dataset into the knowledge base if not already present."""
        embedding_provider = get_embedding_provider()
        total_chunks_seeded = 0

        for src_data in CURATED_LEGAL_SOURCES:
            # Check if source already exists by title and short_code
            existing = await db.execute(
                select(LegalSource).where(LegalSource.short_code == src_data["short_code"])
            )
            source = existing.scalar_one_or_none()

            if not source:
                full_text_for_hash = "".join(c["chunk_text"] for c in src_data.get("chunks", []))
                source_checksum = compute_sha256(full_text_for_hash)

                source = LegalSource(
                    source_type=src_data["source_type"],
                    title=src_data["title"],
                    short_code=src_data.get("short_code"),
                    citation=src_data.get("citation"),
                    jurisdiction=src_data.get("jurisdiction", "Union of India"),
                    court=src_data.get("court"),
                    act_or_judgment_identifier=src_data.get("act_or_judgment_identifier"),
                    publication_date=src_data.get("publication_date"),
                    last_verified_date=src_data.get("last_verified_date"),
                    document_version=src_data.get("document_version", "1.0"),
                    content_checksum=source_checksum,
                    official_source_url=src_data.get("official_source_url"),
                    year=src_data.get("year"),
                    verification_status="VERIFIED",
                    ingestion_status="COMPLETED",
                    metadata_json={},
                )
                db.add(source)
                await db.flush()

                for chunk_data in src_data.get("chunks", []):
                    c_text = chunk_data["chunk_text"]
                    c_checksum = compute_sha256(c_text)
                    token_est = int(len(re.findall(r"\w+", c_text)) * 1.3)

                    # Generate embedding incorporating source context
                    embed_vector = embedding_provider.embed_document(
                        text=f"{chunk_data.get('section_number', '')} {chunk_data.get('clause_heading', '')}: {c_text}",
                        title=src_data["title"],
                    )

                    chunk = LegalChunk(
                        source_id=source.id,
                        section_number=chunk_data.get("section_number"),
                        clause_heading=chunk_data.get("clause_heading"),
                        chunk_text=c_text,
                        token_count=token_est,
                        content_checksum=c_checksum,
                        embedding_status="COMPLETED",
                        embedding=embed_vector,
                        metadata_json={"short_code": src_data.get("short_code")},
                    )
                    db.add(chunk)
                    total_chunks_seeded += 1

        await db.commit()
        logger.info(f"Seeded {total_chunks_seeded} curated legal chunks into knowledge base.")
        return total_chunks_seeded

    @classmethod
    async def ingest_document(
        cls,
        db: AsyncSession,
        source_metadata: Dict[str, Any],
        raw_content: Union[bytes, str],
        file_format: str,
        filename: Optional[str] = None,
        force_reprocess: bool = False,
        require_verified_source: bool = True,
        batch_size: int = 50,
    ) -> Tuple[LegalSource, LegalIngestionJob]:
        """Execute end-to-end legal document ingestion using LegalDocumentIngestionPipeline."""
        from app.modules.legal_knowledge.ingestion_pipeline import LegalDocumentIngestionPipeline

        return await LegalDocumentIngestionPipeline.ingest_document(
            db=db,
            source_metadata=source_metadata,
            raw_content=raw_content,
            file_format=file_format,
            filename=filename,
            force_reprocess=force_reprocess,
            require_verified_source=require_verified_source,
            batch_size=batch_size,
        )

    @classmethod
    async def create_source(cls, db: AsyncSession, payload: LegalSourceCreate) -> LegalSource:
        """Register a new verified legal source record."""
        source = LegalSource(
            source_type=payload.source_type,
            title=payload.title,
            short_code=payload.short_code,
            citation=payload.citation,
            jurisdiction=payload.jurisdiction,
            court=payload.court,
            act_or_judgment_identifier=payload.act_or_judgment_identifier,
            publication_date=payload.publication_date,
            last_verified_date=payload.last_verified_date,
            document_version=payload.document_version,
            official_source_url=payload.official_source_url,
            metadata_json=payload.metadata_json or {},
        )
        db.add(source)
        await db.commit()
        await db.refresh(source)
        return source

    @classmethod
    async def ingest_chunk(
        cls,
        db: AsyncSession,
        source_id: uuid.UUID,
        payload: LegalChunkCreate,
    ) -> LegalChunk:
        """Ingest and embed a section chunk for an existing source."""
        embedding_provider = get_embedding_provider()
        c_text = payload.chunk_text.strip()
        c_checksum = compute_sha256(c_text)
        token_est = int(len(re.findall(r"\w+", c_text)) * 1.3)

        embed_vector = embedding_provider.embed_document(
            text=f"{payload.section_number or ''} {payload.clause_heading or ''}: {c_text}",
            title=payload.clause_heading or payload.section_number,
        )

        chunk = LegalChunk(
            source_id=source_id,
            section_number=payload.section_number,
            clause_heading=payload.clause_heading,
            chunk_text=c_text,
            token_count=token_est,
            content_checksum=c_checksum,
            embedding=embed_vector,
            metadata_json=payload.metadata_json or {},
        )
        db.add(chunk)
        await db.commit()
        await db.refresh(chunk)
        return chunk

    @classmethod
    async def reembed_all_chunks(cls, db: AsyncSession) -> int:
        """Re-embed all existing legal chunks using the active embedding provider.
        
        Preserves all document metadata, sources, section numbers, and integrity checksums.
        Ensures consistency across all stored vectors and validates vector dimensions.
        """
        embedding_provider = get_embedding_provider()
        res = await db.execute(select(LegalChunk).options(selectinload(LegalChunk.source)))
        chunks = res.scalars().all()

        reembedded_count = 0
        for chunk in chunks:
            title = chunk.source.title if chunk.source else None
            new_vector = embedding_provider.embed_document(chunk.chunk_text, title=title)
            if len(new_vector) != settings.EMBEDDING_VECTOR_DIMENSION:
                raise ValueError(
                    f"Re-embedding failed: vector dimension {len(new_vector)} != {settings.EMBEDDING_VECTOR_DIMENSION}"
                )
            chunk.embedding = new_vector
            reembedded_count += 1

        await db.commit()
        logger.info(f"Successfully re-embedded {reembedded_count} chunks using {embedding_provider.provider_name}.")
        return reembedded_count
