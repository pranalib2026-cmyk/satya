"""Provider-independent Advocate Credential Verification Engine.

This module defines the abstract verification interface and concrete
implementations for automatic format validation and manual admin review.

Future official API integrations (e.g., BCI / State Bar Council APIs)
should implement the VerificationProvider interface.
"""

import abc
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from app.modules.advocates.schemas import (
    normalize_enrollment_number,
    validate_enrollment_format,
)


@dataclass
class VerificationResult:
    """Immutable record of a verification check outcome."""

    is_valid: bool
    method: str  # AUTOMATIC | MANUAL_ADMIN | OFFICIAL_API
    evidence_level: Optional[str] = None  # DOCUMENTS_REVIEWED | OFFICIAL_ROLL_MATCHED | COUNCIL_CONFIRMED
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    message: str = ""
    checked_at: datetime = None

    def __post_init__(self):
        if self.checked_at is None:
            self.checked_at = datetime.now(timezone.utc)


class VerificationProvider(abc.ABC):
    """Abstract interface for credential verification providers.

    Implementations:
    - AutomaticFormatValidator: Validates enrollment number format.
    - ManualAdminVerifier: Records manual admin review decisions.
    - (Future) OfficialAPIVerifier: Integrates with State Bar Council APIs.
    """

    @abc.abstractmethod
    async def validate_enrollment_format(
        self, enrollment_number: str, bar_council_name: str
    ) -> VerificationResult:
        """Check if enrollment number matches the expected format for the given council."""
        ...

    @abc.abstractmethod
    async def check_duplicate_enrollment(
        self, enrollment_number_normalized: str, exclude_advocate_id: Optional[str] = None
    ) -> VerificationResult:
        """Check if the normalized enrollment number already exists in the system."""
        ...

    @abc.abstractmethod
    async def verify_against_official_source(
        self, enrollment_number: str, bar_council_name: str, enrollment_name: str
    ) -> VerificationResult:
        """Attempt verification against an official source (API, database, or manual lookup)."""
        ...

    @abc.abstractmethod
    async def submit_for_manual_review(self, application_id: str) -> VerificationResult:
        """Mark an application as requiring manual admin review."""
        ...

    @abc.abstractmethod
    async def record_verification_result(
        self,
        application_id: str,
        result: VerificationResult,
        reviewer_id: Optional[str] = None,
    ) -> None:
        """Persist a verification result to the audit trail."""
        ...


class AutomaticFormatValidator(VerificationProvider):
    """Validates enrollment number format against known State Bar Council patterns.

    IMPORTANT: Format validation does NOT prove enrollment.
    It only checks that the enrollment number matches the expected pattern.
    """

    async def validate_enrollment_format(
        self, enrollment_number: str, bar_council_name: str
    ) -> VerificationResult:
        is_valid, message = validate_enrollment_format(enrollment_number, bar_council_name)
        return VerificationResult(
            is_valid=is_valid,
            method="AUTOMATIC",
            evidence_level=None,  # Format check alone is NOT evidence
            source_name="NyayaSetu Format Validator",
            message=message,
        )

    async def check_duplicate_enrollment(
        self, enrollment_number_normalized: str, exclude_advocate_id: Optional[str] = None
    ) -> VerificationResult:
        # This must be checked at the database layer in the service
        return VerificationResult(
            is_valid=True,
            method="AUTOMATIC",
            message="Duplicate check deferred to database service layer.",
        )

    async def verify_against_official_source(
        self, enrollment_number: str, bar_council_name: str, enrollment_name: str
    ) -> VerificationResult:
        """No official API integration available yet."""
        return VerificationResult(
            is_valid=False,
            method="AUTOMATIC",
            message=(
                f"Official verification for {bar_council_name} is not yet available. "
                "Application will be queued for manual admin review."
            ),
        )

    async def submit_for_manual_review(self, application_id: str) -> VerificationResult:
        return VerificationResult(
            is_valid=True,
            method="MANUAL_ADMIN",
            message="Application submitted for manual admin review.",
        )

    async def record_verification_result(
        self,
        application_id: str,
        result: VerificationResult,
        reviewer_id: Optional[str] = None,
    ) -> None:
        # Recording is handled by the service layer via AuditLog
        pass


class ManualAdminVerifier(VerificationProvider):
    """Manual verification by platform administrators.

    Admin reviews uploaded documents and optionally cross-references
    with official State Bar Council records.
    """

    async def validate_enrollment_format(
        self, enrollment_number: str, bar_council_name: str
    ) -> VerificationResult:
        is_valid, message = validate_enrollment_format(enrollment_number, bar_council_name)
        return VerificationResult(
            is_valid=is_valid,
            method="MANUAL_ADMIN",
            message=message,
        )

    async def check_duplicate_enrollment(
        self, enrollment_number_normalized: str, exclude_advocate_id: Optional[str] = None
    ) -> VerificationResult:
        return VerificationResult(
            is_valid=True,
            method="MANUAL_ADMIN",
            message="Duplicate check deferred to database service layer.",
        )

    async def verify_against_official_source(
        self, enrollment_number: str, bar_council_name: str, enrollment_name: str
    ) -> VerificationResult:
        return VerificationResult(
            is_valid=False,
            method="MANUAL_ADMIN",
            message="Manual admin review: official source verification performed by reviewer.",
        )

    async def submit_for_manual_review(self, application_id: str) -> VerificationResult:
        return VerificationResult(
            is_valid=True,
            method="MANUAL_ADMIN",
            message="Flagged for admin review.",
        )

    async def record_verification_result(
        self,
        application_id: str,
        result: VerificationResult,
        reviewer_id: Optional[str] = None,
    ) -> None:
        pass


# Default verification provider
def get_verification_provider() -> VerificationProvider:
    """Factory returning the active verification provider.

    Currently returns AutomaticFormatValidator.
    When an official API integration becomes available,
    this factory can be updated to return the appropriate provider.
    """
    return AutomaticFormatValidator()
