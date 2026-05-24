from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models import Contact, Conversation, Message
from app.config import INSTAGRAM_TOKEN
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/conversations")
def get_conversations(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    # Tüm konuşmaları contact ve status ile birlikte tek sorguda çek
    conversations = db.query(Conversation).options(
        joinedload(Conversation.contact).joinedload(Contact.status)
    ).order_by(Conversation.last_message_at.desc()).limit(limit).offset(offset).all()

    # Son mesajları tek sorguda çek (N+1 problemi çözümü)
    conv_ids = [conv.id for conv in conversations]
    last_messages = {}
    
    if conv_ids:
        subq = db.query(
            Message.conversation_id,
            func.max(Message.id).label("max_id")
        ).filter(
            Message.conversation_id.in_(conv_ids)
        ).group_by(Message.conversation_id).subquery()

        msgs = db.query(Message).join(
            subq, Message.id == subq.c.max_id
        ).all()

        last_messages = {m.conversation_id: m.content for m in msgs}

    result = []
    for conv in conversations:
        result.append({
            "id": conv.id,
            "platform": conv.platform,
            "unread_count": conv.unread_count,
            "last_message_at": str(conv.last_message_at),
            "contact": {
                "id": conv.contact.id,
                "name": conv.contact.name,
                "full_name": conv.contact.full_name,
                "phone": conv.contact.phone,
                "external_id": conv.contact.external_id,
                "status_id": conv.contact.status_id,
                "status": {
                    "id": conv.contact.status.id,
                    "name": conv.contact.status.name,
                    "color": conv.contact.status.color
                } if conv.contact.status else None,
            },
            "last_message": last_messages.get(conv.id)
        })

    return result

@router.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: int, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.timestamp.asc()).all()

    return [{
        "id": m.id,
        "content": m.content,
        "direction": m.direction,
        "timestamp": str(m.timestamp),
        "is_read": m.is_read,
        "message_type": m.message_type
    } for m in messages]

@router.post("/conversations/{conversation_id}/reply")
async def reply_message(conversation_id: int, request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    text = body.get("text")

    if not text:
        return {"error": "Mesaj boş olamaz"}

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        return {"error": "Konuşma bulunamadı"}

    contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()

    url = "https://graph.instagram.com/v19.0/me/messages"
    payload = {
        "recipient": {"id": contact.external_id},
        "message": {"text": text},
        "access_token": INSTAGRAM_TOKEN
    }

    response = await request.app.state.http.post(url, json=payload)
    result = response.json()
    print("Instagram yanıt:", result)

    if "error" not in result:
        new_message = Message(
            conversation_id=conversation_id,
            direction="outbound",
            content=text,
            platform=conversation.platform,
            is_read=True,
            timestamp=datetime.utcnow()
        )
        db.add(new_message)
        db.commit()
        return {"status": "ok"}

    return {"error": result.get("error", {}).get("message", "Bilinmeyen hata")}

@router.get("/conversations/{conversation_id}/window")
def check_window(conversation_id: int, db: Session = Depends(get_db)):
    last_inbound = db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.direction == "inbound"
    ).order_by(Message.timestamp.desc()).first()

    if not last_inbound:
        return {"open": False, "message": "Henüz müşteriden mesaj gelmedi"}

    time_diff = datetime.utcnow() - last_inbound.timestamp
    remaining = timedelta(hours=24) - time_diff

    if time_diff > timedelta(hours=24):
        hours_passed = int(time_diff.total_seconds() / 3600)
        return {
            "open": False,
            "message": f"Mesajlaşma penceresi kapandı. Son mesajın üzerinden {hours_passed} saat geçti."
        }

    hours_left = int(remaining.total_seconds() / 3600)
    minutes_left = int((remaining.total_seconds() % 3600) / 60)
    return {
        "open": True,
        "message": f"Pencere açık — {hours_left} saat {minutes_left} dk kaldı"
    }