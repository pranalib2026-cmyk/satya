"""Document Management Service.

Handles secure file storage, SHA-256 integrity verification, MIME validation,
case ownership permissions, and short-lived authorized download tokens.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import os
from pathlib import Path
import re
import secrets
from typing import List, Optional, Tuple
import uuid

from fastapi import UploadFile
import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException
from app.core.logging import logger
from app.core.storage import BaseStorageProvider, get_storage_provider
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile
from app.modules.cases.models import LegalCase
from app.modules.documents.models import Document
from app.modules.documents.ocr import DocumentOCREngine, OCRExtractionResult
from app.modules.documents.schemas import (
    DocumentAmountItem,
    DocumentDateItem,
    DocumentDownloadTokenResponse,
    DocumentExplanationResponse,
    DocumentResponse,
    DocumentScanResponse,
)
from app.modules.legal_assistant.citation_validator import CitationValidator
from app.modules.legal_assistant.llm_provider import get_llm_provider
from app.modules.legal_assistant.retrieval import LegalRetrievalEngine
from app.modules.legal_assistant.schemas import CitationItem
from app.modules.legal_knowledge.ingestion import LegalIngestionService
from app.modules.legal_knowledge.models import LegalChunk
from app.modules.users.models import User

# Base directory for private document vault (strictly outside any public frontend path)
VAULT_DIR = Path(__file__).resolve().parent.parent.parent.parent / "storage" / "vault"

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".docx", ".doc"}
# Initial individual upload limit: 10 Megabytes (configurable via settings.STORAGE_MAX_FILE_SIZE_BYTES)
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


def validate_file_content_signature(content: bytes, ext: str, mime_type: str) -> None:
    """Validate file content against magic bytes for declared extension and MIME type.

    Prevents extension spoofing, disguised executable payloads, and truncated uploads.
    """
    if len(content) < 4:
        raise BadRequestException(message="File content is too small or truncated.")

    # Extension to magic bytes signature validation
    if ext == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise BadRequestException(
                message="File content signature does not match PDF format. File appears corrupted or disguised."
            )
    elif ext in (".jpg", ".jpeg"):
        if not content.startswith(b"\xff\xd8\xff"):
            raise BadRequestException(
                message="File content signature does not match JPEG format. File appears corrupted or disguised."
            )
    elif ext == ".png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise BadRequestException(
                message="File content signature does not match PNG format. File appears corrupted or disguised."
            )
    elif ext == ".docx":
        if not content.startswith(b"PK\x03\x04"):
            raise BadRequestException(
                message="File content signature does not match DOCX format. File appears corrupted or disguised."
            )
    elif ext == ".doc":
        if not content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
            raise BadRequestException(
                message="File content signature does not match legacy DOC format. File appears corrupted or disguised."
            )


class DocumentService:
    """Business logic for secure legal document vault."""

    @classmethod
    async def _verify_case_permission(
        cls,
        db: AsyncSession,
        case_id: uuid.UUID,
        user: User,
    ) -> LegalCase:
        """Verify user is case client, assigned advocate, or platform admin."""
        res = await db.execute(select(LegalCase).where(LegalCase.id == case_id))
        case = res.scalar_one_or_none()
        if not case:
            raise NotFoundException(message=f"Case with ID '{case_id}' was not found.")

        if user.role == "CITIZEN":
            if case.client_id != user.id:
                raise ForbiddenException(
                    message="Access forbidden: You do not have permission to access documents for this case."
                )
        elif user.role == "ADVOCATE":
            adv_res = await db.execute(
                select(AdvocateProfile.id).where(AdvocateProfile.user_id == user.id)
            )
            adv_id = adv_res.scalar_one_or_none()
            if not adv_id or case.lead_advocate_id != adv_id:
                raise ForbiddenException(
                    message="Access forbidden: You are not the assigned advocate for this case."
                )
        # ADMIN is permitted

        return case

    @classmethod
    async def upload_document(
        cls,
        db: AsyncSession,
        case_id: Optional[uuid.UUID],
        file: UploadFile,
        document_category: str,
        current_user: User,
        is_confidential: bool = True,
        storage_provider: Optional[BaseStorageProvider] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Document:
        """Upload and store a case document with validation, checksum, and provider-independent storage."""
        # 1. Enforce Case Access Permissions (if case_id provided)
        if case_id:
            await cls._verify_case_permission(db, case_id, current_user)

        # 2. Validate Extension & MIME Type
        original_filename = file.filename or "uploaded_document"
        ext = os.path.splitext(original_filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise BadRequestException(
                message=f"File extension '{ext}' is not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )

        content_type = file.content_type or "application/octet-stream"
        if content_type not in ALLOWED_MIME_TYPES:
            raise BadRequestException(
                message=f"MIME type '{content_type}' is not supported. Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}"
            )

        # 3. Read content & Validate Individual File Size (10 MB limit)
        content = await file.read()
        file_size = len(content)
        max_file_size = settings.STORAGE_MAX_FILE_SIZE_BYTES or MAX_FILE_SIZE_BYTES
        if file_size > max_file_size:
            max_mb = max_file_size // (1024 * 1024)
            raise BadRequestException(
                message=f"File exceeds maximum allowed upload size of {max_mb}MB (Received: {round(file_size / (1024*1024), 2)}MB)."
            )
        if file_size == 0:
            raise BadRequestException(message="Uploaded file is empty.")

        # 4. Actual File Content Signature (Magic Bytes) Validation
        validate_file_content_signature(content, ext, content_type)

        # 5. Enforce Application-Level Total Storage Capacity Limit (8 GB)
        total_stored_res = await db.execute(select(func.coalesce(func.sum(Document.file_size_bytes), 0)))
        total_stored_bytes = total_stored_res.scalar() or 0
        if total_stored_bytes + file_size > settings.STORAGE_TOTAL_CAPACITY_BYTES:
            capacity_gb = settings.STORAGE_TOTAL_CAPACITY_BYTES // (1024 * 1024 * 1024)
            raise BadRequestException(
                message=f"Application storage capacity limit reached ({capacity_gb}GB). "
                f"Unable to process new upload at this time. Please contact support."
            )

        # 6. Enforce Per-User Quotas, Document Limits, and Upload Rate Limits (for non-admins)
        if current_user.role != "ADMIN":
            # Per-user storage quota
            user_stored_res = await db.execute(
                select(func.coalesce(func.sum(Document.file_size_bytes), 0)).where(
                    Document.uploader_id == current_user.id
                )
            )
            user_stored_bytes = user_stored_res.scalar() or 0
            if user_stored_bytes + file_size > settings.STORAGE_USER_QUOTA_BYTES:
                quota_mb = settings.STORAGE_USER_QUOTA_BYTES // (1024 * 1024)
                raise BadRequestException(
                    message=f"User storage quota of {quota_mb}MB exceeded. "
                    f"Current usage: {round(user_stored_bytes / (1024 * 1024), 2)}MB. "
                    f"Please delete unused documents before uploading new files."
                )

            # Per-user document count limit
            user_doc_count_res = await db.execute(
                select(func.count(Document.id)).where(Document.uploader_id == current_user.id)
            )
            user_doc_count = user_doc_count_res.scalar() or 0
            if user_doc_count >= settings.STORAGE_USER_MAX_DOCUMENTS:
                raise BadRequestException(
                    message=f"User document limit of {settings.STORAGE_USER_MAX_DOCUMENTS} documents reached. "
                    f"Please delete older documents before uploading new ones."
                )

            # Per-user upload rate limit
            one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
            recent_uploads_res = await db.execute(
                select(func.count(AuditLog.id)).where(
                    AuditLog.actor_id == current_user.id,
                    AuditLog.action == "DOCUMENT_UPLOADED",
                    AuditLog.created_at >= one_hour_ago,
                )
            )
            recent_uploads_count = recent_uploads_res.scalar() or 0
            if recent_uploads_count >= settings.STORAGE_USER_UPLOAD_RATE_LIMIT_PER_HOUR:
                raise BadRequestException(
                    message=f"Upload rate limit exceeded ({settings.STORAGE_USER_UPLOAD_RATE_LIMIT_PER_HOUR} uploads per hour). "
                    f"Please wait before attempting additional uploads."
                )

        # 7. Compute Cryptographic SHA-256 Checksum
        sha256_hash = hashlib.sha256(content).hexdigest()

        # 8. Persist to Storage Provider with Unpredictable Object Key
        doc_id = uuid.uuid4()
        unpredictable_token = secrets.token_hex(16)
        if case_id:
            storage_key = f"vault/cases/{case_id}/{doc_id}_{unpredictable_token}{ext}"
        else:
            storage_key = f"vault/users/{current_user.id}/{doc_id}_{unpredictable_token}{ext}"
        provider = storage_provider or get_storage_provider()

        uploaded_to_storage = False
        try:
            await provider.upload(
                key=storage_key,
                content=content,
                content_type=content_type,
                metadata={"case_id": str(case_id) if case_id else "", "uploader_id": str(current_user.id)},
            )
            uploaded_to_storage = True

            local_path = provider.get_local_path(storage_key)
            storage_path_value = str(local_path) if local_path else storage_key

            # 9. Save Metadata in Database
            document = Document(
                id=doc_id,
                case_id=case_id,
                uploader_id=current_user.id,
                file_name=original_filename,
                file_size_bytes=file_size,
                mime_type=content_type,
                storage_backend=provider.backend_name,
                storage_key=storage_key,
                storage_path=storage_path_value,
                checksum_sha256=sha256_hash,
                is_confidential=is_confidential,
                document_category=document_category,
                processing_status="uploaded",
                metadata_json={"original_extension": ext},
            )
            db.add(document)

            # 10. Audit Log (Never logs document contents or personal information)
            audit = AuditLog(
                actor_id=current_user.id,
                action="DOCUMENT_UPLOADED",
                entity_type="documents",
                entity_id=str(document.id),
                ip_address=ip_address,
                user_agent=user_agent,
                payload_snapshot={
                    "case_id": str(case_id),
                    "file_name": original_filename,
                    "file_size": file_size,
                    "mime_type": content_type,
                    "checksum_sha256": sha256_hash,
                    "storage_backend": provider.backend_name,
                    "storage_key": storage_key,
                },
            )
            db.add(audit)
            await db.commit()
            await db.refresh(document)

            logger.info(
                f"Document uploaded: id={document.id} case={case_id} backend={provider.backend_name} size={file_size}"
            )
            return document

        except Exception as exc:
            # Atomic rollback: If file was uploaded to storage but database commit failed, delete orphaned object
            if uploaded_to_storage:
                try:
                    await provider.delete(storage_key)
                    logger.warning(f"Cleaned up orphaned storage object '{storage_key}' after upload failure.")
                except Exception as cleanup_exc:
                    logger.error(f"Failed to clean up orphaned storage object '{storage_key}': {cleanup_exc}")
            await db.rollback()
            raise

    @classmethod
    async def list_case_documents(
        cls,
        db: AsyncSession,
        case_id: uuid.UUID,
        current_user: User,
    ) -> List[Document]:
        """List documents for a case, enforcing access permissions."""
        await cls._verify_case_permission(db, case_id, current_user)
        res = await db.execute(
            select(Document).where(Document.case_id == case_id).order_by(Document.created_at.desc())
        )
        return list(res.scalars().all())

    @classmethod
    async def get_document(
        cls,
        db: AsyncSession,
        document_id: uuid.UUID,
        current_user: User,
    ) -> Document:
        """Fetch document metadata with permission enforcement."""
        res = await db.execute(select(Document).where(Document.id == document_id))
        doc = res.scalar_one_or_none()
        if not doc:
            raise NotFoundException(message=f"Document with ID '{document_id}' was not found.")

        if doc.case_id:
            await cls._verify_case_permission(db, doc.case_id, current_user)
        elif current_user.role != "ADMIN" and doc.uploader_id != current_user.id:
            raise ForbiddenException(message="Access forbidden: You do not own this document.")

        return doc

    @classmethod
    async def generate_download_token(
        cls,
        db: AsyncSession,
        document_id: uuid.UUID,
        current_user: User,
        storage_provider: Optional[BaseStorageProvider] = None,
    ) -> DocumentDownloadTokenResponse:
        """Generate short-lived signed download token valid for 15 minutes."""
        doc = await cls.get_document(db, document_id, current_user)
        provider = storage_provider or get_storage_provider()

        payload = {
            "sub": str(current_user.id),
            "doc_id": str(doc.id),
            "type": "document_download",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

        # If provider supports direct presigned download URLs (e.g. Cloudflare R2), generate presigned URL
        target_key = doc.storage_key or doc.storage_path
        presigned_url: Optional[str] = None
        if provider.supports_presigned_urls:
            presigned_url = await provider.generate_download_url(
                key=target_key,
                expiry_seconds=900,
                filename=doc.file_name,
            )

        download_url = presigned_url or f"{settings.API_V1_PREFIX}/documents/{doc.id}/download?token={token}"

        return DocumentDownloadTokenResponse(
            document_id=doc.id,
            file_name=doc.file_name,
            download_url=download_url,
            expires_in_seconds=900,
            token=token,
        )

    @classmethod
    async def get_document_for_download(
        cls,
        db: AsyncSession,
        document_id: uuid.UUID,
        current_user: Optional[User] = None,
        token: Optional[str] = None,
        storage_provider: Optional[BaseStorageProvider] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[Document, str]:
        """Verify token or user credentials and return document model and physical path or presigned URL."""
        res = await db.execute(select(Document).where(Document.id == document_id))
        doc = res.scalar_one_or_none()
        if not doc:
            raise NotFoundException(message="Document not found.")

        # If download token is provided in query param
        actor_id: Optional[uuid.UUID] = None
        if token:
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                if payload.get("type") != "document_download" or payload.get("doc_id") != str(doc.id):
                    raise UnauthorizedException(message="Invalid or mismatched download token.")
                user_id_str = payload.get("sub")
                if user_id_str:
                    actor_id = uuid.UUID(user_id_str)
            except jwt.ExpiredSignatureError:
                raise UnauthorizedException(message="Download token has expired. Please generate a new one.")
            except jwt.InvalidTokenError:
                raise UnauthorizedException(message="Invalid download token signature.")
        elif current_user:
            actor_id = current_user.id
            if doc.case_id:
                await cls._verify_case_permission(db, doc.case_id, current_user)
            elif current_user.role != "ADMIN" and doc.uploader_id != current_user.id:
                raise ForbiddenException(message="Access forbidden.")
        else:
            raise UnauthorizedException(message="Authentication required to download this document.")

        provider = storage_provider or get_storage_provider()
        target_key = doc.storage_key or doc.storage_path

        # Verify existence in storage provider or legacy filesystem path
        exists_in_storage = await provider.exists(target_key)
        if not exists_in_storage:
            if not (doc.storage_path and os.path.exists(doc.storage_path)):
                raise NotFoundException(message="Document physical file missing from private storage vault.")
            target_key = doc.storage_path

        # Audit Download
        audit = AuditLog(
            actor_id=actor_id,
            action="DOCUMENT_DOWNLOADED",
            entity_type="documents",
            entity_id=str(doc.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={"file_name": doc.file_name, "checksum": doc.checksum_sha256},
        )
        db.add(audit)
        await db.commit()

        # If provider supports presigned URLs, generate and return it
        if provider.supports_presigned_urls:
            presigned_url = await provider.generate_download_url(
                key=target_key,
                expiry_seconds=900,
                filename=doc.file_name,
            )
            if presigned_url:
                return doc, presigned_url

        # Check for local file path
        local_path = provider.get_local_path(target_key)
        if local_path and os.path.exists(local_path):
            return doc, str(local_path)
        if doc.storage_path and os.path.exists(doc.storage_path):
            return doc, doc.storage_path

        return doc, target_key

    @classmethod
    async def delete_document(
        cls,
        db: AsyncSession,
        document_id: uuid.UUID,
        current_user: User,
        storage_provider: Optional[BaseStorageProvider] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """Delete document from storage provider and database with permission enforcement."""
        doc = await cls.get_document(db, document_id, current_user)
        provider = storage_provider or get_storage_provider()

        target_key = doc.storage_key or doc.storage_path
        await provider.delete(target_key)

        # Audit Delete
        audit = AuditLog(
            actor_id=current_user.id,
            action="DOCUMENT_DELETED",
            entity_type="documents",
            entity_id=str(doc.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "case_id": str(doc.case_id) if doc.case_id else None,
                "file_name": doc.file_name,
                "storage_backend": doc.storage_backend,
                "storage_key": doc.storage_key,
            },
        )
        db.add(audit)
        await db.delete(doc)
        await db.commit()

        logger.info(f"Document deleted: id={doc.id} key={target_key}")
        return True

    @classmethod
    async def run_ocr(
        cls,
        db: AsyncSession,
        document_id: uuid.UUID,
        current_user: User,
        storage_provider: Optional[BaseStorageProvider] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[Document, OCRExtractionResult]:
        """Perform real OCR extraction on a stored document with status tracking."""
        doc = await cls.get_document(db, document_id, current_user)
        provider = storage_provider or get_storage_provider()
        target_key = doc.storage_key or doc.storage_path

        # 1. Update status to processing
        doc.processing_status = "processing"
        await db.commit()
        await db.refresh(doc)

        # 2. Download raw content from storage provider
        try:
            content = await provider.download(target_key)
        except Exception as exc:
            doc.processing_status = "failed"
            doc.processing_error = f"Storage download failure: {exc}"
            doc.processed_at = datetime.now(timezone.utc)
            await db.commit()
            raise NotFoundException(message=f"Could not retrieve document bytes from vault: {exc}")

        # 3. Process with real DocumentOCREngine
        try:
            ocr_res = DocumentOCREngine.process_document(
                content=content,
                file_name=doc.file_name,
                mime_type=doc.mime_type,
            )

            doc.processing_status = "completed"
            doc.extracted_text = ocr_res.text
            doc.ocr_confidence = ocr_res.confidence
            doc.ocr_engine = ocr_res.engine_name
            doc.processed_at = datetime.now(timezone.utc)
            if not ocr_res.text:
                doc.processing_error = "No readable text detected in document."
            else:
                doc.processing_error = None

            # Update metadata json
            current_meta = dict(doc.metadata_json or {})
            current_meta["low_confidence"] = ocr_res.low_confidence
            current_meta["ocr_engine"] = ocr_res.engine_name
            current_meta["page_count"] = ocr_res.page_count
            doc.metadata_json = current_meta

        except Exception as exc:
            logger.warning(f"Document OCR extraction failed for doc {doc.id}: {exc}")
            doc.processing_status = "failed"
            doc.processing_error = str(exc)
            doc.ocr_confidence = 0.0
            doc.processed_at = datetime.now(timezone.utc)
            ocr_res = OCRExtractionResult(
                text="",
                confidence=0.0,
                engine_name="failed",
                low_confidence=True,
                page_count=1,
                char_count=0,
            )

        # 4. Audit Log
        audit = AuditLog(
            actor_id=current_user.id,
            action="DOCUMENT_OCR_PROCESSED",
            entity_type="documents",
            entity_id=str(doc.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "status": doc.processing_status,
                "confidence": doc.ocr_confidence,
                "engine": doc.ocr_engine,
                "char_count": len(doc.extracted_text or ""),
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(doc)
        return doc, ocr_res

    @classmethod
    async def scan_document(
        cls,
        db: AsyncSession,
        file: UploadFile,
        current_user: User,
        case_id: Optional[uuid.UUID] = None,
        document_category: str = "EVIDENCE",
        is_confidential: bool = True,
        storage_provider: Optional[BaseStorageProvider] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[Document, OCRExtractionResult]:
        """Upload a document and immediately execute optical character extraction."""
        # Step 1: Upload and store in vault
        doc = await cls.upload_document(
            db=db,
            case_id=case_id,
            file=file,
            document_category=document_category,
            current_user=current_user,
            is_confidential=is_confidential,
            storage_provider=storage_provider,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # Step 2: Run real OCR
        return await cls.run_ocr(
            db=db,
            document_id=doc.id,
            current_user=current_user,
            storage_provider=storage_provider,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    @classmethod
    async def explain_document(
        cls,
        db: AsyncSession,
        document_id: uuid.UUID,
        current_user: User,
        storage_provider: Optional[BaseStorageProvider] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DocumentExplanationResponse:
        """Analyze actual extracted document text using grounded legal RAG and LLM provider."""
        doc = await cls.get_document(db, document_id, current_user)

        # If OCR not performed yet, perform it now
        if not doc.extracted_text and doc.processing_status in {"uploaded", "failed"}:
            doc, _ = await cls.run_ocr(
                db=db,
                document_id=doc.id,
                current_user=current_user,
                storage_provider=storage_provider,
                ip_address=ip_address,
                user_agent=user_agent,
            )

        extracted_text = (doc.extracted_text or "").strip()
        if not extracted_text:
            raise BadRequestException(
                message="Cannot generate legal explanation: Document contains no readable text or characters."
            )

        # Ensure statutory corpus is seeded for grounding
        chunk_count_res = await db.execute(select(func.count(LegalChunk.id)))
        if (chunk_count_res.scalar() or 0) == 0:
            await LegalIngestionService.seed_curated_corpus(db)

        # Retrieve relevant legal chunks based on extracted document text
        retrieved_chunks = await LegalRetrievalEngine.retrieve(
            db=db,
            query=extracted_text[:400],
            max_sources=5,
        )

        # Run grounded LLM explanation
        llm = get_llm_provider()
        raw_explanation = llm.explain_legal_document(
            extracted_text=extracted_text,
            retrieved_chunks=retrieved_chunks,
            file_name=doc.file_name,
        )

        # Validate citations strictly against retrieved context
        raw_citations = raw_explanation.get("citations", [])
        verified_citations, _ = CitationValidator.validate_and_filter_citations(
            answer_text=raw_explanation.get("summary", ""),
            claimed_references=raw_citations,
            retrieved_chunks=retrieved_chunks,
        )

        # Build response
        date_items = [
            DocumentDateItem(label=d.get("label", "Date"), value=d.get("value", ""))
            for d in raw_explanation.get("dates", [])
            if isinstance(d, dict) and d.get("value")
        ]
        amount_items = [
            DocumentAmountItem(label=a.get("label", "Amount"), value=a.get("value", ""))
            for a in raw_explanation.get("amounts", [])
            if isinstance(a, dict) and a.get("value")
        ]

        sources_found = raw_explanation.get("sources_found", False) and len(verified_citations) > 0

        explanation_response = DocumentExplanationResponse(
            document_id=doc.id,
            document_type=raw_explanation.get("document_type", "Legal Document"),
            summary=raw_explanation.get("summary", ""),
            parties=raw_explanation.get("parties", []),
            dates=date_items,
            amounts=amount_items,
            obligations=raw_explanation.get("obligations", []),
            risks=raw_explanation.get("risks", []),
            citations=verified_citations,
            sources_found=sources_found,
            disclaimer=raw_explanation.get("disclaimer", (
                "NyayaSetu provides an AI-assisted preliminary legal assessment and document explanation. "
                "It is not a law firm and does not provide legal advice. "
                "Submitting a document does not create an advocate-client relationship."
            )),
            confidence=raw_explanation.get("confidence", 0.9),
            extracted_text_snippet=extracted_text[:350],
        )

        # Persist explanation in document metadata
        meta = dict(doc.metadata_json or {})
        meta["explanation"] = explanation_response.model_dump(mode="json")
        doc.metadata_json = meta

        # Audit Log
        audit = AuditLog(
            actor_id=current_user.id,
            action="DOCUMENT_EXPLAINED",
            entity_type="documents",
            entity_id=str(doc.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "document_type": explanation_response.document_type,
                "parties_count": len(explanation_response.parties),
                "citations_count": len(explanation_response.citations),
                "sources_found": sources_found,
            },
        )
        db.add(audit)
        await db.commit()

        return explanation_response
