"""Birden çok router'da tekrarlanan ortak sorgu yapıları."""
from sqlalchemy import func, or_
from app.models import Conversation, Message


def waiting_conversations_q(db):
    """Son mesajı inbound + cevap-dismiss edilmemiş konuşmaların temel sorgusu.

    Caller projeksiyonu kendisi uygular:
      - .with_entities(Conversation.id).distinct()          → bekleyen conversation id'leri
      - .with_entities(Conversation.contact_id).distinct()  → bekleyen contact id'leri
      - .with_entities(func.count(Conversation.id)).scalar() → sayım
    (max_id konuşma başına tekil olduğu için join 1:1; distinct yedek güvence.)
    """
    max_msg_subq = (
        db.query(
            Message.conversation_id.label("conv_id"),
            func.max(Message.id).label("max_id"),
        )
        .group_by(Message.conversation_id)
        .subquery()
    )
    return (
        db.query(Conversation)
        .join(max_msg_subq, max_msg_subq.c.conv_id == Conversation.id)
        .join(Message, Message.id == max_msg_subq.c.max_id)
        .filter(
            Message.direction == "inbound",
            or_(
                Conversation.reply_dismissed_at.is_(None),
                Conversation.reply_dismissed_at < Message.timestamp,
            ),
        )
    )
