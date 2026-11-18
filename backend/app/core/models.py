"""Consolidated ORM Model Registry for Alembic Discovery and Declarative Metadata."""

from app.core.database import Base
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile, AdvocateVerification, AdvocateVerificationApplication
from app.modules.appointments.models import Appointment
from app.modules.auth.models import RefreshToken
from app.modules.cases.models import CaseMessage, LegalCase
from app.modules.deadlines.models import Deadline
from app.modules.documents.models import Document
from app.modules.legal_knowledge.models import LegalChunk, LegalSource
from app.modules.triage.models import ConsultationRequest
from app.modules.users.models import User

__all__ = [
    "Base",
    "User",
    "RefreshToken",
    "AdvocateProfile",
    "AdvocateVerification",
    "AdvocateVerificationApplication",
    "LegalCase",
    "CaseMessage",
    "ConsultationRequest",
    "Appointment",
    "LegalSource",
    "LegalChunk",
    "Document",
    "Deadline",
    "AuditLog",
]
