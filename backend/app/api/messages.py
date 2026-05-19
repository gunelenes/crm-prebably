from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Contact, Conversation, Message
from app.config import INSTAGRAM_TOKEN
from datetime import datetime, timedelta
import httpx

router = APIRouter()

@router.get("/conversations")
def get_conversations(db: Session = Depends(get_db)):
    conversations = db.query(Conversation).join(Contact).order_by(
        Conversation.last_message_at.desc()
    ).all()

    result = []
    for conv in conversations:
        last_message = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.timestamp.desc()).first()

        result.append({
            "id": conv.id,
            "platform": conv.platform,
            "unread_count": conv.unread_count,
            "last_message_at": str(conv.last_message_at),
            "contact": {
                "id": conv.contact.id,
                "name": conv.contact.name,
                "phone": conv.contact.phone,
                "external_id": conv.contact.external_id,
            },
            "last_message": last_message.content if last_message else None
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

    # Instagram'a mesaj gönder
    url = "https://graph.instagram.com/v19.0/me/messages"
    payload = {
        "recipient": {"id": contact.external_id},
        "message": {"text": text},
        "access_token": INSTAGRAM_TOKEN
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
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