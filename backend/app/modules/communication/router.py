"""Chambers Communication and Direct Messaging API Router."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user
from app.modules.communication.schemas import (
    BlockConversationResponse,
    ConversationCreateRequest,
    ConversationListResponse,
    ConversationResponse,
    MarkReadResponse,
    MessageCreateRequest,
    MessageListResponse,
    MessageResponse,
    ReportConversationRequest,
)
from app.modules.communication.service import CommunicationService
from app.modules.users.models import User

router = APIRouter(prefix="/conversations", tags=["Chambers Communication & Direct Messaging"])


@router.get(
    "",
    response_model=ConversationListResponse,
    summary="List Conversations",
    description="Retrieve all active confidential chambers communication threads for the authenticated user.",
)
async def list_conversations(
    limit: int = Query(50, ge=1, le=100, description="Max threads to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    items, total = await CommunicationService.list_conversations(
        db=db,
        current_user=current_user,
        limit=limit,
        offset=offset,
    )
    return ConversationListResponse(items=items, total=total)


@router.post(
    "",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or Retrieve Conversation",
    description="Start a new confidential communication thread or return existing thread with an authorized participant.",
)
async def create_conversation(
    payload: ConversationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await CommunicationService.get_or_create_conversation(
        db=db,
        current_user=current_user,
        payload=payload,
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get Conversation Details",
    description="Retrieve specific conversation metadata. Strictly restricts access to authorized participants.",
)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conv = await CommunicationService.get_conversation(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
    )
    return await CommunicationService.format_conversation_response(db, conv, current_user)


@router.get(
    "/{conversation_id}/messages",
    response_model=MessageListResponse,
    summary="Get Conversation Messages",
    description="Retrieve paginated chronological message history for an authorized chambers thread.",
)
async def get_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(100, ge=1, le=200, description="Max messages to fetch"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    messages, total = await CommunicationService.get_messages(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
        limit=limit,
        offset=offset,
    )
    page = (offset // limit) + 1
    return MessageListResponse(
        items=messages,
        total=total,
        page=page,
        limit=limit,
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send Message",
    description="Transmit a real, persistent message into an authorized chambers thread.",
)
async def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await CommunicationService.send_message(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
        payload=payload,
    )


@router.post(
    "/{conversation_id}/read",
    response_model=MarkReadResponse,
    summary="Mark Thread Messages Read",
    description="Mark all unread incoming messages in the thread as read.",
)
async def mark_messages_as_read(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    marked_count = await CommunicationService.mark_messages_as_read(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
    )
    return MarkReadResponse(ok=True, marked_count=marked_count)


@router.post(
    "/{conversation_id}/block",
    response_model=BlockConversationResponse,
    summary="Block Conversation",
    description="Sever inbound communication and block future messages.",
)
async def block_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await CommunicationService.block_conversation(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
    )
    return BlockConversationResponse(conversation_id=conversation_id)


@router.post(
    "/{conversation_id}/report",
    summary="Report Conversation Grievance",
    description="Lodge a confidential grievance notice regarding conversation conduct for administrative inspection.",
)
async def report_conversation(
    conversation_id: uuid.UUID,
    payload: ReportConversationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await CommunicationService.report_conversation(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
        reason=payload.reason,
    )
    return {"ok": True, "message": "Grievance report recorded for regulatory inspection."}
