"""Pydantic schemas for Direct Messaging and Chambers Dispatch."""

from datetime import datetime
import uuid
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class MessageCreateRequest(BaseModel):
    """Payload to send a message within a conversation."""

    content: str = Field(..., min_length=1, max_length=5000, description="Message text body")
    attachment_name: Optional[str] = Field(None, max_length=255, description="Optional attached document label")
    attachment_document_id: Optional[uuid.UUID] = Field(None, description="Optional Vault Document UUID")

    @field_validator("content")
    @classmethod
    def validate_content_not_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Message content cannot be blank or whitespace only.")
        return trimmed


class ConversationCreateRequest(BaseModel):
    """Payload to start or get an existing conversation thread."""

    recipient_id: uuid.UUID = Field(
        ...,
        description="Target user ID or advocate profile ID to communicate with",
    )
    case_id: Optional[uuid.UUID] = Field(None, description="Optional associated case dossier ID")
    appointment_id: Optional[uuid.UUID] = Field(None, description="Optional associated consultation booking ID")
    subject: Optional[str] = Field(None, max_length=255, description="Thread subject matter")
    initial_message: Optional[str] = Field(
        None,
        min_length=1,
        max_length=5000,
        description="Optional initial dispatch message",
    )

    @field_validator("initial_message")
    @classmethod
    def validate_initial_message(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Initial message cannot be whitespace only.")
            return trimmed
        return v


class ConversationParticipant(BaseModel):
    """Summary of a participant in a conversation."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    full_name: str
    role: str
    initials: str
    advocate_profile_id: Optional[uuid.UUID] = None
    primary_practice: Optional[str] = None
    bar_council_id: Optional[str] = None


class MessageResponse(BaseModel):
    """Message representation compatible with both REST clients and the Editorial Dashboard."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    thread_id: uuid.UUID
    threadId: Optional[uuid.UUID] = None
    sender_id: uuid.UUID
    senderId: Optional[uuid.UUID] = None
    from_role: str = Field(..., alias="from")
    text: str
    at: datetime
    attachment_name: Optional[str] = None
    attachmentName: Optional[str] = None
    attachment_document_id: Optional[uuid.UUID] = None
    attachmentDocumentId: Optional[uuid.UUID] = None
    is_read: bool
    isRead: Optional[bool] = None
    read_at: Optional[datetime] = None
    readAt: Optional[datetime] = None
    delivery_status: str = "DELIVERED"
    deliveryStatus: Optional[str] = None

    @model_validator(mode="after")
    def populate_dual_casing(self) -> "MessageResponse":
        self.threadId = self.threadId or self.thread_id
        self.senderId = self.senderId or self.sender_id
        self.attachmentName = self.attachmentName or self.attachment_name
        self.attachmentDocumentId = self.attachmentDocumentId or self.attachment_document_id
        self.isRead = self.is_read if self.isRead is None else self.isRead
        self.readAt = self.readAt or self.read_at
        self.deliveryStatus = self.deliveryStatus or self.delivery_status
        return self


class ConversationResponse(BaseModel):
    """Conversation thread representation compatible with Thread interface."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    advocate_id: str
    advocateId: Optional[str] = None
    advocate_name: str
    advocateName: Optional[str] = None
    initials: str
    last_message: str
    lastMessage: Optional[str] = None
    last_at: datetime
    lastAt: Optional[datetime] = None
    unread: int
    online: bool
    status: str
    case_id: Optional[uuid.UUID] = None
    caseId: Optional[uuid.UUID] = None
    case_title: Optional[str] = None
    caseTitle: Optional[str] = None
    appointment_id: Optional[uuid.UUID] = None
    appointmentId: Optional[uuid.UUID] = None
    other_participant: ConversationParticipant
    otherParticipant: Optional[ConversationParticipant] = None
    created_at: datetime
    createdAt: Optional[datetime] = None

    @model_validator(mode="after")
    def populate_dual_casing(self) -> "ConversationResponse":
        self.advocateId = self.advocateId or self.advocate_id
        self.advocateName = self.advocateName or self.advocate_name
        self.lastMessage = self.lastMessage or self.last_message
        self.lastAt = self.lastAt or self.last_at
        self.caseId = self.caseId or self.case_id
        self.caseTitle = self.caseTitle or self.case_title
        self.appointmentId = self.appointmentId or self.appointment_id
        self.otherParticipant = self.otherParticipant or self.other_participant
        self.createdAt = self.createdAt or self.created_at
        return self


class ConversationListResponse(BaseModel):
    """Paginated list of conversation threads."""

    items: List[ConversationResponse]
    total: int


class MessageListResponse(BaseModel):
    """Paginated list of messages for a conversation."""

    items: List[MessageResponse]
    total: int
    page: int
    limit: int


class MarkReadResponse(BaseModel):
    """Response returned upon marking a thread's messages as read."""

    ok: bool = True
    marked_count: int


class BlockConversationResponse(BaseModel):
    """Response returned upon blocking a conversation."""

    ok: bool = True
    conversation_id: uuid.UUID
    status: str = "BLOCKED"
    message: str = "Conversation has been blocked. Inbound communications severed."


class ReportConversationRequest(BaseModel):
    """Payload to lodge a compliance or misconduct report."""

    reason: str = Field(..., min_length=3, max_length=1000, description="Detailed explanation of grievance")
