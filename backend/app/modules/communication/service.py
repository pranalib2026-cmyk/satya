"""Chambers Direct Communication and Messaging Service."""

from datetime import datetime, timezone
from typing import List, Optional, Tuple
import uuid

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import BadRequestException, ForbiddenException, NotFoundException
from app.core.logging import logger
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile
from app.modules.appointments.models import Appointment
from app.modules.cases.models import LegalCase
from app.modules.communication.models import Conversation, Message
from app.modules.communication.schemas import (
    ConversationCreateRequest,
    ConversationParticipant,
    ConversationResponse,
    MessageCreateRequest,
    MessageResponse,
)
from app.modules.users.models import User


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


def extract_initials(name: Optional[str]) -> str:
    """Derive uppercase initials from full name (e.g., 'Adv. Meera Sen' -> 'MS')."""
    if not name:
        return "NY"
    cleaned = name.strip()
    # Strip common titles and prefixes
    for prefix in ("adv.", "adv ", "advocate ", "dr.", "mr.", "ms.", "mrs."):
        if cleaned.lower().startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
            break
    parts = [p.strip() for p in cleaned.split() if p.strip()]
    if not parts:
        return "NY"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[-1][0]}".upper()


class CommunicationService:
    """Business logic for chambers conversations, dispatch threads, and confidential messages."""

    @classmethod
    async def resolve_recipient(
        cls,
        db: AsyncSession,
        recipient_id: uuid.UUID,
    ) -> Tuple[User, Optional[AdvocateProfile]]:
        """Resolve recipient identifier which may be a User.id or an AdvocateProfile.id."""
        # 1. Check if recipient_id is a User ID
        user_stmt = (
            select(User)
            .options(selectinload(User.advocate_profile))
            .where(User.id == recipient_id, User.is_active == True)
        )
        user = (await db.execute(user_stmt)).scalar_one_or_none()
        if user:
            return user, user.advocate_profile

        # 2. Check if recipient_id is an AdvocateProfile ID
        adv_stmt = (
            select(AdvocateProfile)
            .options(selectinload(AdvocateProfile.user))
            .where(AdvocateProfile.id == recipient_id)
        )
        adv_profile = (await db.execute(adv_stmt)).scalar_one_or_none()
        if adv_profile and adv_profile.user and adv_profile.user.is_active:
            return adv_profile.user, adv_profile

        raise NotFoundException(message="Recipient user or advocate profile not found.")

    @classmethod
    async def check_communication_eligibility(
        cls,
        db: AsyncSession,
        current_user: User,
        target_user: User,
        case_id: Optional[uuid.UUID] = None,
        appointment_id: Optional[uuid.UUID] = None,
    ) -> None:
        """Validate statutory and platform eligibility to communicate."""
        if current_user.id == target_user.id:
            raise BadRequestException(message="Cannot initiate a communication thread with yourself.")

        # Platform administrators may communicate with any user for support/compliance
        if current_user.role == "ADMIN" or target_user.role == "ADMIN":
            return

        # Citizen <-> Advocate consultations are allowed
        roles = {current_user.role, target_user.role}
        if roles == {"CITIZEN", "ADVOCATE"}:
            return

        # If both are CITIZEN or both are ADVOCATE, verify they share an active case or appointment
        case_filter = or_(
            (LegalCase.client_id == current_user.id) & (LegalCase.client_id == target_user.id),
        )
        if case_id:
            shared_case = await db.scalar(
                select(LegalCase).where(
                    LegalCase.id == case_id,
                    (LegalCase.client_id == current_user.id) | (LegalCase.client_id == target_user.id),
                )
            )
            if shared_case:
                return

        if appointment_id:
            shared_appt = await db.scalar(
                select(Appointment).where(
                    Appointment.id == appointment_id,
                    (Appointment.client_id == current_user.id) | (Appointment.client_id == target_user.id),
                )
            )
            if shared_appt:
                return

        raise ForbiddenException(
            message="Direct communication between citizens without an active shared legal matter is prohibited under platform rules."
        )

    @classmethod
    async def get_or_create_conversation(
        cls,
        db: AsyncSession,
        current_user: User,
        payload: ConversationCreateRequest,
    ) -> ConversationResponse:
        """Fetch existing conversation or instantiate a new confidential chambers thread."""
        target_user, adv_profile = await cls.resolve_recipient(db, payload.recipient_id)

        await cls.check_communication_eligibility(
            db=db,
            current_user=current_user,
            target_user=target_user,
            case_id=payload.case_id,
            appointment_id=payload.appointment_id,
        )

        # Canonical participant ordering (smaller UUID as participant_one)
        p1_id, p2_id = (
            (current_user.id, target_user.id)
            if current_user.id < target_user.id
            else (target_user.id, current_user.id)
        )

        query = select(Conversation).where(
            Conversation.participant_one_id == p1_id,
            Conversation.participant_two_id == p2_id,
        )
        if payload.case_id:
            query = query.where(Conversation.case_id == payload.case_id)

        conversation = (await db.execute(query)).scalar_one_or_none()

        if not conversation:
            now = utc_now()
            conversation = Conversation(
                participant_one_id=p1_id,
                participant_two_id=p2_id,
                case_id=payload.case_id,
                appointment_id=payload.appointment_id,
                subject=payload.subject,
                status="ACTIVE",
                last_message_at=now,
            )
            db.add(conversation)
            await db.flush()
            await db.refresh(conversation)

        # If initial message provided, save it
        if payload.initial_message:
            msg = Message(
                conversation_id=conversation.id,
                sender_id=current_user.id,
                content=payload.initial_message,
                is_read=False,
                delivery_status="DELIVERED",
                created_at=utc_now(),
            )
            db.add(msg)
            conversation.last_message_at = utc_now()
            await db.flush()

        await db.commit()
        return await cls.format_conversation_response(db, conversation, current_user)

    @classmethod
    async def list_conversations(
        cls,
        db: AsyncSession,
        current_user: User,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[ConversationResponse], int]:
        """List active chambers communication threads for the authenticated user."""
        filter_clause = or_(
            Conversation.participant_one_id == current_user.id,
            Conversation.participant_two_id == current_user.id,
        )

        total_stmt = select(func.count()).select_from(Conversation).where(filter_clause)
        total = (await db.scalar(total_stmt)) or 0

        conversations_stmt = (
            select(Conversation)
            .where(filter_clause)
            .order_by(Conversation.last_message_at.desc())
            .offset(offset)
            .limit(limit)
        )
        conversations = (await db.execute(conversations_stmt)).scalars().all()

        formatted_items = []
        for conv in conversations:
            formatted = await cls.format_conversation_response(db, conv, current_user)
            formatted_items.append(formatted)

        return formatted_items, total

    @classmethod
    async def get_conversation(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        current_user: User,
    ) -> Conversation:
        """Fetch conversation entity and enforce participant access control."""
        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.participant_one),
                selectinload(Conversation.participant_two),
                selectinload(Conversation.case),
            )
            .where(Conversation.id == conversation_id)
        )
        conversation = (await db.execute(stmt)).scalar_one_or_none()
        if not conversation:
            raise NotFoundException(message=f"Conversation thread '{conversation_id}' not found.")

        is_participant = current_user.id in (
            conversation.participant_one_id,
            conversation.participant_two_id,
        )
        if not is_participant and current_user.role != "ADMIN":
            raise ForbiddenException(
                message="Access denied. You are not an authorized participant in this confidential chambers thread."
            )

        return conversation

    @classmethod
    async def get_messages(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        current_user: User,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[MessageResponse], int]:
        """Fetch chronological message log for an authorized conversation."""
        conversation = await cls.get_conversation(db, conversation_id, current_user)

        total_stmt = (
            select(func.count())
            .select_from(Message)
            .where(Message.conversation_id == conversation.id)
        )
        total = (await db.scalar(total_stmt)) or 0

        messages_stmt = (
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        messages = (await db.execute(messages_stmt)).scalars().all()

        responses = [
            cls.format_message_response(msg, current_user)
            for msg in messages
        ]
        return responses, total

    @classmethod
    async def send_message(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        current_user: User,
        payload: MessageCreateRequest,
    ) -> MessageResponse:
        """Send a real, persistent message in an authorized conversation thread."""
        conversation = await cls.get_conversation(db, conversation_id, current_user)

        if conversation.status == "BLOCKED":
            raise BadRequestException(
                message="This communication thread has been blocked. Messages cannot be transmitted."
            )

        now = utc_now()
        message = Message(
            conversation_id=conversation.id,
            sender_id=current_user.id,
            content=payload.content,
            attachment_name=payload.attachment_name,
            attachment_document_id=payload.attachment_document_id,
            is_read=False,
            delivery_status="DELIVERED",
            created_at=now,
        )
        db.add(message)

        # Update parent conversation timestamp and reopen if archived
        conversation.last_message_at = now
        if conversation.status == "ARCHIVED":
            conversation.status = "ACTIVE"

        await db.commit()
        await db.refresh(message)

        return cls.format_message_response(message, current_user)

    @classmethod
    async def mark_messages_as_read(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        current_user: User,
    ) -> int:
        """Mark all unread incoming messages in a thread as read by the current user."""
        conversation = await cls.get_conversation(db, conversation_id, current_user)

        now = utc_now()
        update_stmt = (
            update(Message)
            .where(
                Message.conversation_id == conversation.id,
                Message.sender_id != current_user.id,
                Message.is_read == False,
            )
            .values(
                is_read=True,
                read_at=now,
                delivery_status="READ",
            )
        )
        result = await db.execute(update_stmt)
        await db.commit()
        return result.rowcount or 0

    @classmethod
    async def block_conversation(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        current_user: User,
    ) -> None:
        """Block a conversation, preventing further inbound messages."""
        conversation = await cls.get_conversation(db, conversation_id, current_user)
        conversation.status = "BLOCKED"
        conversation.blocked_by_id = current_user.id

        other_id = (
            conversation.participant_two_id
            if conversation.participant_one_id == current_user.id
            else conversation.participant_one_id
        )

        audit = AuditLog(
            actor_id=current_user.id,
            action="CONVERSATION_BLOCKED",
            entity_type="conversations",
            entity_id=str(conversation.id),
            payload_snapshot={
                "blocked_by": str(current_user.id),
                "other_participant": str(other_id),
                "blocked_at": utc_now().isoformat(),
            },
        )
        db.add(audit)
        await db.commit()

    @classmethod
    async def report_conversation(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        current_user: User,
        reason: str,
    ) -> None:
        """Lodge a confidential misconduct / compliance report for procedural review."""
        conversation = await cls.get_conversation(db, conversation_id, current_user)

        other_id = (
            conversation.participant_two_id
            if conversation.participant_one_id == current_user.id
            else conversation.participant_one_id
        )

        audit = AuditLog(
            actor_id=current_user.id,
            action="CONVERSATION_REPORTED",
            entity_type="conversations",
            entity_id=str(conversation.id),
            payload_snapshot={
                "reporter_id": str(current_user.id),
                "reported_user_id": str(other_id),
                "reason": reason,
                "reported_at": utc_now().isoformat(),
            },
        )
        db.add(audit)
        await db.commit()

    @classmethod
    async def format_conversation_response(
        cls,
        db: AsyncSession,
        conversation: Conversation,
        current_user: User,
    ) -> ConversationResponse:
        """Format Conversation database model into a frontend-ready response."""
        other_user_id = (
            conversation.participant_two_id
            if conversation.participant_one_id == current_user.id
            else conversation.participant_one_id
        )

        other_user = await db.scalar(
            select(User)
            .options(selectinload(User.advocate_profile))
            .where(User.id == other_user_id)
        )

        full_name = other_user.full_name if other_user else "Authorized Chambers"
        role = other_user.role if other_user else "ADVOCATE"
        adv_profile = other_user.advocate_profile if other_user else None
        advocate_id = str(adv_profile.id) if adv_profile else str(other_user_id)
        primary_practice = adv_profile.primary_practice if adv_profile else None
        bar_council_id = adv_profile.bar_council_id if adv_profile else None

        # Fetch latest message preview
        latest_msg_stmt = (
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        latest_msg = (await db.execute(latest_msg_stmt)).scalar_one_or_none()

        last_message = latest_msg.content if latest_msg else (conversation.subject or "Privileged communication channel initiated.")
        last_at = latest_msg.created_at if latest_msg else conversation.last_message_at

        # Calculate unread messages sent by the other party
        unread_stmt = (
            select(func.count())
            .select_from(Message)
            .where(
                Message.conversation_id == conversation.id,
                Message.sender_id != current_user.id,
                Message.is_read == False,
            )
        )
        unread = (await db.scalar(unread_stmt)) or 0

        # Fetch case title if linked
        case_title = None
        if conversation.case_id:
            case = await db.scalar(select(LegalCase).where(LegalCase.id == conversation.case_id))
            if case:
                case_title = case.title

        return ConversationResponse(
            id=conversation.id,
            advocate_id=advocate_id,
            advocate_name=full_name,
            initials=extract_initials(full_name),
            last_message=last_message,
            last_at=last_at,
            unread=unread,
            online=True if (other_user and other_user.is_active) else False,
            status=conversation.status,
            case_id=conversation.case_id,
            case_title=case_title,
            appointment_id=conversation.appointment_id,
            other_participant=ConversationParticipant(
                id=other_user_id,
                full_name=full_name,
                role=role,
                initials=extract_initials(full_name),
                advocate_profile_id=adv_profile.id if adv_profile else None,
                primary_practice=primary_practice,
                bar_council_id=bar_council_id,
            ),
            created_at=conversation.created_at,
        )

    @classmethod
    def format_message_response(
        cls,
        message: Message,
        current_user: User,
    ) -> MessageResponse:
        """Map Message model to response schema with role-contextual 'from' attribute."""
        if message.sender_id == current_user.id:
            from_role = "user"
        else:
            from_role = "advocate" if current_user.role == "CITIZEN" else "user"

        return MessageResponse(
            id=message.id,
            thread_id=message.conversation_id,
            sender_id=message.sender_id,
            from_role=from_role,
            text=message.content,
            at=message.created_at,
            attachment_name=message.attachment_name,
            attachment_document_id=message.attachment_document_id,
            is_read=message.is_read,
            read_at=message.read_at,
            delivery_status=message.delivery_status,
        )
