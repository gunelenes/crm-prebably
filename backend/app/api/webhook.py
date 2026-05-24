from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import WEBHOOK_VERIFY_TOKEN
from app.models import Contact, Conversation, Message
from datetime import datetime, timedelta

router = APIRouter()

async def get_instagram_username(sender_id: str) -> str:
    from app.config import INSTAGRAM_TOKEN
    from app import main as app_main
    try:
        url = f"https://graph.instagram.com/v19.0/{sender_id}?fields=name,username&access_token={INSTAGRAM_TOKEN}"
        response = await app_main.http_client.get(url)
        data = response.json()
        return data.get("name") or data.get("username") or f"Instagram Kullanici {sender_id[-6:]}"
    except:
        return f"Instagram Kullanici {sender_id[-6:]}"

async def save_message(db, sender_id, text, mid, platform):
    from app.models import ActivityLog, Status

    ilk_mesaj_status = db.query(Status).filter(Status.name == "İlk Mesaj").first()

    contact = db.query(Contact).filter(Contact.external_id == sender_id).first()
    is_new = False

    if not contact:
        is_new = True
        real_name = await get_instagram_username(sender_id)
        contact = Contact(
            platform=platform,
            external_id=sender_id,
            name=real_name,
            status_id=ilk_mesaj_status.id if ilk_mesaj_status else None,
        )
        db.add(contact)
        db.flush()

        # Aktivite logu — ilk mesaj
        log = ActivityLog(
            contact_id=contact.id,
            type="first_message",
            title="🎉 İlk mesaj gönderildi",
            description=f"Platform: {platform} | Mesaj: {text[:100]}",
            new_status_id=ilk_mesaj_status.id if ilk_mesaj_status else None,
            created_at=datetime.utcnow()
        )
        db.add(log)

    elif not contact.status_id and ilk_mesaj_status:
        contact.status_id = ilk_mesaj_status.id
        log = ActivityLog(
            contact_id=contact.id,
            type="status_change",
            title="Otomatik statü atandı: İlk Mesaj",
            description="Daha önce statüsü olmayan kullanıcıya otomatik atandı",
            new_status_id=ilk_mesaj_status.id,
            created_at=datetime.utcnow()
        )
        db.add(log)

    conversation = db.query(Conversation).filter(
        Conversation.contact_id == contact.id,
        Conversation.platform == platform
    ).first()
    if not conversation:
        conversation = Conversation(
            contact_id=contact.id,
            platform=platform,
            unread_count=0
        )
        db.add(conversation)
        db.flush()

    new_message = Message(
        conversation_id=conversation.id,
        direction="inbound",
        content=text,
        platform=platform,
        external_id=mid,
        is_read=False,
        timestamp=datetime.utcnow()
    )
    db.add(new_message)
    conversation.unread_count += 1
    conversation.last_message_at = datetime.utcnow()
    db.commit()
    print(f"Mesaj kaydedildi: {sender_id} → {text} (yeni kullanıcı: {is_new})")

    try:
        from app.main import sio
        await sio.emit("new_message", {
            "platform": platform,
            "sender_id": sender_id,
            "conversation_id": conversation.id,
            "text": text,
            "direction": "inbound",
            "is_new": is_new
        })
    except:
        pass

@router.get("/webhook")
def verify_webhook(request: Request):
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    if mode == "subscribe" and token == WEBHOOK_VERIFY_TOKEN:
        return int(challenge)
    return {"error": "Doğrulama başarısız"}

@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    print("Gelen webhook:", body)

    if body.get("object") == "instagram":
        for entry in body.get("entry", []):
            our_id = entry.get("id")  # Bizim Instagram hesabımızın ID'si

            for messaging in entry.get("messaging", []):
                sender_id = messaging.get("sender", {}).get("id")
                message = messaging.get("message", {})
                text = message.get("text")

                # Kendi gönderdiğimiz mesajları atla
                if sender_id == our_id:
                    continue

                if text and sender_id:
                    await save_message(db, sender_id, text, message.get("mid"), "instagram")

            for change in entry.get("changes", []):
                if change.get("field") == "messages":
                    value = change.get("value", {})
                    sender_id = value.get("sender", {}).get("id")
                    our_id_change = value.get("recipient", {}).get("id")
                    message = value.get("message", {})
                    text = message.get("text")

                    # Kendi gönderdiğimiz mesajları atla
                    if sender_id == our_id_change:
                        continue

                    if text and sender_id:
                        await save_message(db, sender_id, text, message.get("mid"), "instagram")

    return {"status": "ok"}

@router.get("/test-instagram")
async def test_instagram(request: Request):
    from app.config import INSTAGRAM_TOKEN
    url = f"https://graph.instagram.com/v19.0/me?fields=id,name&access_token={INSTAGRAM_TOKEN}"
    response = await request.app.state.http.get(url)
    return response.json()

@router.get("/test-conversations")
async def test_conversations(request: Request):
    from app.config import INSTAGRAM_TOKEN
    url = f"https://graph.instagram.com/v19.0/me/conversations?fields=id,participants&access_token={INSTAGRAM_TOKEN}"
    response = await request.app.state.http.get(url)
    return response.json()

# @router.post("/sync-conversations")
# async def sync_conversations(db: Session = Depends(get_db)):
#     from app.config import INSTAGRAM_TOKEN
    
#     synced = 0
#     page_url = f"https://graph.instagram.com/v19.0/me/conversations?fields=id,participants,messages{{message,from,created_time,id}}&access_token={INSTAGRAM_TOKEN}"
    
#     async with httpx.AsyncClient(timeout=30.0) as client:
#         while page_url:
#             response = await client.get(page_url)
#             data = response.json()
            
#             if "error" in data:
#                 return {"error": data["error"]}
            
#             for conv in data.get("data", []):
#                 participants = conv.get("participants", {}).get("data", [])
                
#                 # Karşı tarafı bul (semtinkizi değil)
#                 other = None
#                 for p in participants:
#                     if p.get("id") != "17841401244343060":
#                         other = p
#                         break
                
#                 if not other:
#                     continue
                
#                 # Contact bul veya oluştur
#                 contact = db.query(Contact).filter(
#                     Contact.external_id == other["id"]
#                 ).first()
                
#                 if not contact:
#                     contact = Contact(
#                         platform="instagram",
#                         external_id=other["id"],
#                         name=other.get("username", f"Instagram {other['id'][-6:]}"),
#                     )
#                     db.add(contact)
#                     db.flush()
                
#                 # Conversation bul veya oluştur
#                 conversation = db.query(Conversation).filter(
#                     Conversation.contact_id == contact.id,
#                     Conversation.platform == "instagram"
#                 ).first()
                
#                 if not conversation:
#                     conversation = Conversation(
#                         contact_id=contact.id,
#                         platform="instagram",
#                         unread_count=0
#                     )
#                     db.add(conversation)
#                     db.flush()
                
#                 # Mesajları kaydet
#                 for msg in conv.get("messages", {}).get("data", []):
#                     existing = db.query(Message).filter(
#                         Message.external_id == msg["id"]
#                     ).first()
                    
#                     if existing:
#                         continue
                    
#                     sender = msg.get("from", {})
#                     direction = "outbound" if sender.get("id") == "17841401244343060" else "inbound"
                    
#                     from datetime import timezone
#                     import dateutil.parser
#                     try:
#                         ts = dateutil.parser.parse(msg["created_time"]).replace(tzinfo=None)
#                     except:
#                         ts = datetime.utcnow()
                    
#                     new_msg = Message(
#                         conversation_id=conversation.id,
#                         direction=direction,
#                         content=msg.get("message", ""),
#                         platform="instagram",
#                         external_id=msg["id"],
#                         is_read=True,
#                         timestamp=ts
#                     )
#                     db.add(new_msg)
#                     synced += 1
                
#                 conversation.last_message_at = datetime.utcnow()
#                 db.commit()
            
#             # Sonraki sayfa
#             page_url = data.get("paging", {}).get("next")
    
#     return {"status": "ok", "synced": synced}

@router.post("/sync-conversations")
def sync_conversations(request: Request, db: Session = Depends(get_db)):
    from app.config import INSTAGRAM_TOKEN
    from datetime import timezone
    import dateutil.parser

    # 15 Mayıs 2026 Cuma başlangıç tarihi
    start_date = datetime(2026, 5, 15, 0, 0, 0)

    synced = 0
    skipped = 0
    # page_url = f"https://graph.instagram.com/v19.0/me/conversations?fields=id,participants,messages{{message,from,created_time,id}}&access_token={INSTAGRAM_TOKEN}"
    page_url = f"https://graph.instagram.com/v19.0/me/conversations?fields=id,participants,messages.limit(10){{message,from,created_time,id}}&access_token={INSTAGRAM_TOKEN}&limit=20"
    client = request.app.state.sync_http
    while page_url:
        response = client.get(page_url, timeout=60.0)
        data = response.json()

        if "error" in data:
            return {"error": data["error"]}

        stop_pagination = False

        for conv in data.get("data", []):
            participants = conv.get("participants", {}).get("data", [])

            # Karşı tarafı bul
            other = None
            for p in participants:
                if p.get("id") != "17841401244343060":
                    other = p
                    break

            if not other:
                continue

            # Contact bul veya oluştur
            contact = db.query(Contact).filter(
                Contact.external_id == other["id"]
            ).first()

            if not contact:
                contact = Contact(
                    platform="instagram",
                    external_id=other["id"],
                    name=other.get("username", f"Instagram {other['id'][-6:]}"),
                )
                db.add(contact)
                db.flush()

            # Conversation bul veya oluştur
            conversation = db.query(Conversation).filter(
                Conversation.contact_id == contact.id,
                Conversation.platform == "instagram"
            ).first()

            if not conversation:
                conversation = Conversation(
                    contact_id=contact.id,
                    platform="instagram",
                    unread_count=0
                )
                db.add(conversation)
                db.flush()

            # Mesajları kaydet
            for msg in conv.get("messages", {}).get("data", []):
                try:
                    msg_time = dateutil.parser.parse(msg["created_time"]).replace(tzinfo=None)
                except:
                    continue

                # 15 Mayıs'tan önceyse atla
                if msg_time < start_date:
                    stop_pagination = True
                    skipped += 1
                    continue

                # Zaten var mı?
                existing = db.query(Message).filter(
                    Message.external_id == msg["id"]
                ).first()

                sender = msg.get("from", {})
                direction = "outbound" if sender.get("id") == "17841401244343060" else "inbound"

                # external_id NULL olan eski satırlar için yedek eşleştirme (content + ±2dk pencere)
                if not existing:
                    existing = db.query(Message).filter(
                        Message.conversation_id == conversation.id,
                        Message.external_id.is_(None),
                        Message.direction == direction,
                        Message.content == msg.get("message", ""),
                        Message.timestamp.between(msg_time - timedelta(minutes=2),
                                                  msg_time + timedelta(minutes=2))
                    ).first()
                    if existing:
                        existing.external_id = msg["id"]  # backfill, bir daha duplicate üretmesin

                if existing:
                    continue

                new_msg = Message(
                    conversation_id=conversation.id,
                    direction=direction,
                    content=msg.get("message", ""),
                    platform="instagram",
                    external_id=msg["id"],
                    is_read=True,
                    timestamp=msg_time
                )
                db.add(new_msg)
                synced += 1

            # Son mesajın gerçek zamanını kullan
            last_msg_time = None
            for msg in conv.get("messages", {}).get("data", []):
                try:
                    t = dateutil.parser.parse(msg["created_time"]).replace(tzinfo=None)
                    if last_msg_time is None or t > last_msg_time:
                        last_msg_time = t
                except:
                    pass
            if last_msg_time:
                conversation.last_message_at = last_msg_time
            db.commit()

        # 15 Mayıs'tan önceki veriye ulaştıysak dur
        if stop_pagination:
            break

        # Sonraki sayfa
        page_url = data.get("paging", {}).get("next")

    return {"status": "ok", "synced": synced, "skipped": skipped}

    