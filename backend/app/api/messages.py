from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from app.database import get_db
from app.models import Contact, Conversation, Message, User, QuickReply
from app.auth import get_current_user, decode_token
from app.config import INSTAGRAM_TOKEN, PUBLIC_BASE_URL, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
from app.utils import iso_utc
from datetime import datetime, timedelta

router = APIRouter()


async def _send_text(request, platform, recipient_id, text):
    """Platforma göre metin mesajı gönderir. Normalize sonuç döner:
    başarı: {"ok": True, "message_id": <id|None>}, hata: {"error": <mesaj>}.
    """
    if platform == "whatsapp":
        if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
            return {"error": "WhatsApp yapılandırılmadı (WHATSAPP_TOKEN/WHATSAPP_PHONE_ID eksik)"}
        url = f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_ID}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_id,
            "type": "text",
            "text": {"body": text},
        }
        headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
        response = await request.app.state.http.post(url, json=payload, headers=headers)
        result = response.json()
        print("WhatsApp yanıt:", result)
        if "error" not in result:
            msgs = result.get("messages", [])
            return {"ok": True, "message_id": msgs[0].get("id") if msgs else None}
        return {"error": result.get("error", {}).get("message", "Bilinmeyen hata")}

    # instagram (varsayılan)
    url = "https://graph.instagram.com/v19.0/me/messages"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": text},
        "access_token": INSTAGRAM_TOKEN,
    }
    response = await request.app.state.http.post(url, json=payload)
    result = response.json()
    print("Instagram yanıt:", result)
    if "error" not in result:
        return {"ok": True, "message_id": result.get("message_id")}
    return {"error": result.get("error", {}).get("message", "Bilinmeyen hata")}

@router.get("/conversations")
def get_conversations(limit: int = 50, offset: int = 0, waiting_for_reply: Optional[bool] = None, q: Optional[str] = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Tüm konuşmaları contact ve status ile birlikte tek sorguda çek
    base_query = db.query(Conversation).options(
        joinedload(Conversation.contact).joinedload(Contact.status)
    )

    # Arama: kişi adı / ad-soyad / telefon / e-posta
    if q:
        like = f"%{q.strip()}%"
        base_query = base_query.join(Contact, Conversation.contact_id == Contact.id).filter(
            or_(
                Contact.name.ilike(like),
                Contact.full_name.ilike(like),
                Contact.phone.ilike(like),
                Contact.email.ilike(like),
            )
        )

    # "Cevap bekliyor" filtresi (server-side) — son mesajı inbound + dismiss edilmemiş.
    # contacts.py search_contacts'taki desenin aynısı, sadece Conversation.id seçiyor.
    if waiting_for_reply is not None:
        max_msg_subq = (
            db.query(
                Message.conversation_id.label("conv_id"),
                func.max(Message.id).label("max_id"),
            )
            .group_by(Message.conversation_id)
            .subquery()
        )
        waiting_conv_ids = (
            db.query(Conversation.id)
            .join(max_msg_subq, max_msg_subq.c.conv_id == Conversation.id)
            .join(Message, Message.id == max_msg_subq.c.max_id)
            .filter(
                Message.direction == "inbound",
                or_(
                    Conversation.reply_dismissed_at.is_(None),
                    Conversation.reply_dismissed_at < Message.timestamp,
                ),
            )
            .distinct()
        )
        if waiting_for_reply:
            base_query = base_query.filter(Conversation.id.in_(waiting_conv_ids))
        else:
            base_query = base_query.filter(~Conversation.id.in_(waiting_conv_ids))

    conversations = (
        base_query.order_by(Conversation.last_message_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

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

        last_messages = {m.conversation_id: (m.content, m.direction, m.timestamp) for m in msgs}

    result = []
    for conv in conversations:
        last_content, last_direction, last_ts = last_messages.get(conv.id, (None, None, None))
        waiting_for_reply = (
            last_direction == "inbound"
            and last_ts is not None
            and (conv.reply_dismissed_at is None or conv.reply_dismissed_at < last_ts)
        )
        result.append({
            "id": conv.id,
            "platform": conv.platform,
            "unread_count": conv.unread_count,
            "last_message_at": iso_utc(conv.last_message_at),
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
            "last_message": last_content,
            "last_message_direction": last_direction,
            "waiting_for_reply": waiting_for_reply,
        })

    return result

@router.post("/conversations/{conversation_id}/dismiss-reply")
def dismiss_reply(conversation_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        return {"error": "Konuşma bulunamadı"}
    conversation.reply_dismissed_at = datetime.utcnow()
    db.commit()
    return {"status": "ok"}

@router.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.timestamp.asc()).all()

    return [{
        "id": m.id,
        "content": m.content,
        "direction": m.direction,
        "timestamp": iso_utc(m.timestamp),
        "is_read": m.is_read,
        "message_type": m.message_type,
        "quick_reply_id": m.quick_reply_id,
    } for m in messages]

@router.post("/conversations/{conversation_id}/reply")
async def reply_message(conversation_id: int, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    body = await request.json()
    text = body.get("text")

    if not text:
        return {"error": "Mesaj boş olamaz"}

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        return {"error": "Konuşma bulunamadı"}

    contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()

    result = await _send_text(request, conversation.platform, contact.external_id, text)

    if "error" not in result:
        now = datetime.utcnow()
        new_message = Message(
            conversation_id=conversation_id,
            direction="outbound",
            content=text,
            platform=conversation.platform,
            external_id=result.get("message_id"),
            is_read=True,
            timestamp=now,
            created_by_user_id=current_user.id,
        )
        db.add(new_message)
        conversation.last_message_at = now
        db.commit()

        try:
            from app.main import sio
            await sio.emit("new_message", {
                "platform": conversation.platform,
                "sender_id": contact.external_id,
                "conversation_id": conversation.id,
                "text": text,
                "direction": "outbound",
                "is_new": False,
            })
        except Exception:
            pass

        return {"status": "ok"}

    # _send_text hata mesajını zaten string olarak normalize ediyor.
    return {"error": result["error"]}

# Gelen medyayı sunar. Token query param ile gelir çünkü <img>/<audio> etiketleri
# Authorization header gönderemez. Müşteri medyası olduğu için public DEĞİL.
@router.get("/messages/{message_id}/media")
def get_message_media(message_id: int, token: str = "", db: Session = Depends(get_db)):
    try:
        decode_token(token)
    except Exception:
        raise HTTPException(401, "Yetkisiz")
    m = db.query(Message).filter(Message.id == message_id).first()
    if not m or not m.media_data:
        raise HTTPException(404, "Medya yok")
    return Response(
        content=bytes(m.media_data),
        media_type=m.media_mime or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.post("/conversations/{conversation_id}/reply-audio")
async def reply_audio(conversation_id: int, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    body = await request.json()
    quick_reply_id = body.get("quick_reply_id")

    if not quick_reply_id:
        return {"error": "Hazır mesaj seçilmedi"}

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        return {"error": "Konuşma bulunamadı"}

    # WhatsApp ses gönderimi medya yükleme + format dönüşümü gerektirir (Faz 4).
    if conversation.platform == "whatsapp":
        return {"error": "WhatsApp için sesli mesaj henüz desteklenmiyor"}

    reply = db.query(QuickReply).filter(QuickReply.id == quick_reply_id).first()
    if not reply or not reply.audio_data:
        return {"error": "Bu hazır mesajın ses dosyası yok"}

    contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()

    # Meta sesi bu public adresten sunucu tarafında çeker.
    audio_url = f"{PUBLIC_BASE_URL.rstrip('/')}/api/quick-replies/{reply.id}/audio"

    url = "https://graph.instagram.com/v19.0/me/messages"
    payload = {
        "recipient": {"id": contact.external_id},
        "message": {"attachment": {"type": "audio", "payload": {"url": audio_url}}},
        "access_token": INSTAGRAM_TOKEN,
    }

    response = await request.app.state.http.post(url, json=payload)
    result = response.json()
    print("Instagram ses yanıtı:", result)

    if "error" not in result:
        now = datetime.utcnow()
        new_message = Message(
            conversation_id=conversation_id,
            direction="outbound",
            content=f"🎤 {reply.title}",
            message_type="audio",
            platform=conversation.platform,
            external_id=result.get("message_id"),
            quick_reply_id=reply.id,
            is_read=True,
            timestamp=now,
            created_by_user_id=current_user.id,
        )
        db.add(new_message)
        conversation.last_message_at = now
        db.commit()

        try:
            from app.main import sio
            await sio.emit("new_message", {
                "platform": conversation.platform,
                "sender_id": contact.external_id,
                "conversation_id": conversation.id,
                "text": f"🎤 {reply.title}",
                "direction": "outbound",
                "is_new": False,
            })
        except Exception:
            pass

        return {"status": "ok"}

    return {"error": result.get("error", {}).get("message", "Bilinmeyen hata")}


@router.get("/conversations/{conversation_id}/window")
def check_window(conversation_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
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