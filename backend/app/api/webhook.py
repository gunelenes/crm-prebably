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
        # Instagram kullanıcı adı (@handle) öncelikli; yoksa görünen ad, o da yoksa fallback.
        return data.get("username") or data.get("name") or f"Instagram Kullanici {sender_id[-6:]}"
    except:
        return f"Instagram Kullanici {sender_id[-6:]}"

# Gelen medya için ring buffer: her türden en fazla bu kadar dosya saklanır.
MEDIA_LIMIT = 50
PREVIEW = {"image": "📷 Görsel", "audio": "🎤 Sesli mesaj"}
PLACEHOLDER = {
    "image": "📷 Görsel (süresi doldu)",
    "audio": "🎤 Sesli mesaj (süresi doldu)",
}
# Tek gösterimlik (view-once) mesaj: Instagram içeriği vermez (payload/URL yok),
# sadece geldiğini belirtebiliriz.
EPHEMERAL_TEXT = "👁️ Tek gösterimlik mesaj geldi (içeriği görüntülenemiyor)"
UNSUPPORTED_TEXT = "⚠️ Desteklenmeyen mesaj türü geldi"


async def _ensure_contact_conv(db, sender_id, platform, preview_text):
    """Kişi + konuşmayı bulur/oluşturur; (contact, conversation, is_new) döner.

    İlk mesaj statüsü atama ve aktivite logu mantığını içerir.
    """
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

        log = ActivityLog(
            contact_id=contact.id,
            type="first_message",
            title="🎉 İlk mesaj gönderildi",
            description=f"Platform: {platform} | Mesaj: {(preview_text or '')[:100]}",
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

    return contact, conversation, is_new


async def _emit_new_message(platform, sender_id, conversation_id, text, is_new):
    try:
        from app.main import sio
        await sio.emit("new_message", {
            "platform": platform,
            "sender_id": sender_id,
            "conversation_id": conversation_id,
            "text": text,
            "direction": "inbound",
            "is_new": is_new,
        })
    except Exception:
        pass


async def save_message(db, sender_id, text, mid, platform):
    contact, conversation, is_new = await _ensure_contact_conv(db, sender_id, platform, text)

    new_message = Message(
        conversation_id=conversation.id,
        direction="inbound",
        content=text,
        message_type="text",
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

    await _emit_new_message(platform, sender_id, conversation.id, text, is_new)


def _evict_old_media(db, media_kind):
    """Bir türden en yeni MEDIA_LIMIT dışındaki dosyaları siler (ring buffer).

    Mesaj satırı kalır ama içeriği placeholder'a döner ve tipi 'text' yapılır ki
    arayüz oynatıcı yüklemeye çalışmasın.
    """
    old = db.query(Message).filter(
        Message.message_type == media_kind,
        Message.direction == "inbound",
        Message.media_data.isnot(None),
    ).order_by(Message.id.desc()).offset(MEDIA_LIMIT).all()
    for m in old:
        m.media_data = None
        m.media_size = None
        m.media_mime = None
        m.message_type = "text"
        m.content = PLACEHOLDER.get(media_kind, "(süresi doldu)")


async def _download_attachment(url):
    from app import main as app_main
    try:
        r = await app_main.http_client.get(url, follow_redirects=True)
        if r.status_code == 200 and r.content:
            mime = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
            return r.content, mime
        print("Medya indirilemedi, durum:", r.status_code)
    except Exception as e:
        print("Medya indirme hatası:", e)
    return None, None


async def save_attachments(db, sender_id, attachments, mid, platform):
    for att in attachments or []:
        att_type = att.get("type")
        url = (att.get("payload") or {}).get("url")
        kind = att_type if att_type in ("image", "audio") else None

        if att_type == "ephemeral":
            preview = EPHEMERAL_TEXT
        else:
            preview = PREVIEW.get(kind, f"📎 İçerik ({att_type})")
        contact, conversation, is_new = await _ensure_contact_conv(db, sender_id, platform, preview)

        media_bytes = media_mime = None
        if kind and url:
            media_bytes, media_mime = await _download_attachment(url)

        if kind and media_bytes:
            content = PREVIEW[kind]
            msg_type = kind
        elif kind:
            content = f"{PREVIEW[kind]} (alınamadı)"
            msg_type = "text"
        elif att_type == "ephemeral":
            content = EPHEMERAL_TEXT
            msg_type = "text"
        else:
            content = f"📎 Desteklenmeyen içerik ({att_type})"
            msg_type = "text"

        msg = Message(
            conversation_id=conversation.id,
            direction="inbound",
            content=content,
            message_type=msg_type,
            platform=platform,
            external_id=mid,
            media_data=media_bytes if msg_type == kind else None,
            media_mime=media_mime if msg_type == kind else None,
            media_size=len(media_bytes) if (media_bytes and msg_type == kind) else None,
            is_read=False,
            timestamp=datetime.utcnow(),
        )
        db.add(msg)
        conversation.unread_count += 1
        conversation.last_message_at = datetime.utcnow()

        if msg_type in ("image", "audio"):
            db.flush()  # id atansın ki eviction sıralaması doğru olsun
            _evict_old_media(db, msg_type)

        db.commit()
        print(f"Medya kaydedildi: {sender_id} → {content}")

        await _emit_new_message(platform, sender_id, conversation.id, content, is_new)

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
                attachments = message.get("attachments")
                is_unsupported = message.get("is_unsupported")
                mid = message.get("mid")

                # Kendi gönderdiğimiz mesajları atla
                if sender_id == our_id:
                    continue

                if attachments and sender_id:
                    await save_attachments(db, sender_id, attachments, mid, "instagram")
                elif text and sender_id:
                    await save_message(db, sender_id, text, mid, "instagram")
                elif is_unsupported and sender_id:
                    await save_message(db, sender_id, UNSUPPORTED_TEXT, mid, "instagram")

            for change in entry.get("changes", []):
                if change.get("field") == "messages":
                    value = change.get("value", {})
                    sender_id = value.get("sender", {}).get("id")
                    our_id_change = value.get("recipient", {}).get("id")
                    message = value.get("message", {})
                    text = message.get("text")
                    attachments = message.get("attachments")
                    is_unsupported = message.get("is_unsupported")
                    mid = message.get("mid")

                    # Kendi gönderdiğimiz mesajları atla
                    if sender_id == our_id_change:
                        continue

                    if attachments and sender_id:
                        await save_attachments(db, sender_id, attachments, mid, "instagram")
                    elif text and sender_id:
                        await save_message(db, sender_id, text, mid, "instagram")
                    elif is_unsupported and sender_id:
                        await save_message(db, sender_id, UNSUPPORTED_TEXT, mid, "instagram")

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


@router.post("/backfill-usernames")
def backfill_usernames(request: Request, db: Session = Depends(get_db)):
    """Tek seferlik: mevcut Instagram kişilerinin `name` alanını kullanıcı adıyla (@handle) günceller.

    Elle verilen isimler `full_name`'de tutulduğu ve görüntü `full_name or name`
    olduğu için bu işlem elle isimlendirilmiş kişileri görünürde değiştirmez.
    """
    from app.config import INSTAGRAM_TOKEN

    client = request.app.state.sync_http
    updated = 0
    failed = 0
    skipped = 0

    contacts = db.query(Contact).filter(Contact.platform == "instagram").all()
    for contact in contacts:
        if not contact.external_id:
            skipped += 1
            continue
        try:
            url = (f"https://graph.instagram.com/v19.0/{contact.external_id}"
                   f"?fields=name,username&access_token={INSTAGRAM_TOKEN}")
            data = client.get(url, timeout=30.0).json()
            username = data.get("username")
            if username and contact.name != username:
                contact.name = username
                updated += 1
            else:
                skipped += 1
        except Exception:
            failed += 1
            continue
    db.commit()

    return {"status": "ok", "updated": updated, "skipped": skipped, "failed": failed,
            "total": len(contacts)}

    