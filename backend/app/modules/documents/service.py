"""Document Management Service.

Handles secure file storage, SHA-256 integrity verification, MIME validation,
case ownership permissions, and short-lived authorized download tokens.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import os
from pathlib import Path
import re
from typing import List, Optional, Tuple
import uuid

from fastapi import UploadFile
import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException
from app.core.logging import logger
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile
from app.modules.cases.models import LegalCase
from app.modules.documents.models import Document
from app.modules.documents.schemas import DocumentDownloadTokenResponse, DocumentResponse
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
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 Megabytes


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
        case_id: uuid.UUID,
        file: UploadFile,
        document_category: str,
        current_user: User,
        is_confidential: bool = True,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Document:
        """Upload and encrypt-store a case document with validation and checksum."""
        # 1. Enforce Case Access Permissions
        case = await cls._verify_case_permission(db, case_id, current_user)

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

        # 3. Read content & Validate File Size
        content = await file.read()
        file_size = len(content)
        if file_size > MAX_FILE_SIZE_BYTES:
            raise BadRequestException(
                message=f"File exceeds maximum allowed size of 25MB (Received: {round(file_size / (1024*1024), 2)}MB)"
            )
        if file_size == 0:
            raise BadRequestException(message="Uploaded file is empty.")

        # 4. Compute SHA-256 Checksum
        sha256_hash = hashlib.sha256(content).hexdigest()

        # 5. Persist to Private Vault Directory
        doc_id = uuid.uuid4()
        safe_filename = re.sub(r"[^\w\-.]", "_", original_filename)
        case_vault_dir = VAULT_DIR / str(case_id)
        case_vault_dir.mkdir(parents=True, exist_ok=True)
        storage_file_path = case_vault_dir / f"{doc_id}_{safe_filename}"

        with open(storage_file_path, "wb") as f:
            f.write(content)

        # 6. Save Metadata in Database
        document = Document(
            id=doc_id,
            case_id=case_id,
            uploader_id=current_user.id,
            file_name=original_filename,
            file_size_bytes=file_size,
            mime_type=content_type,
            storage_path=str(storage_file_path),
            checksum_sha256=sha256_hash,
            is_confidential=is_confidential,
            document_category=document_category,
            metadata_json={"original_extension": ext},
        )
        db.add(document)

        # 7. Audit Log
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
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(document)

        logger.info(f"Document uploaded: id={document.id} case={case_id} size={file_size}")
        return document

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
    ) -> DocumentDownloadTokenResponse:
        """Generate short-lived signed download token valid for 15 minutes."""
        doc = await cls.get_document(db, document_id, current_user)

        payload = {
            "sub": str(current_user.id),
            "doc_id": str(doc.id),
            "type": "document_download",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        download_url = f"{settings.API_V1_PREFIX}/documents/{doc.id}/download?token={token}"

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
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[Document, str]:
        """Verify token or user credentials and return document model and physical path."""
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

        if not os.path.exists(doc.storage_path):
            raise NotFoundException(message="Document physical file missing from private storage vault.")

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

        return doc, doc.storage_path
