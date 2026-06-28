import hmac
import hashlib
import json
from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import WEBHOOK_VERIFY_TOKEN, INSTAGRAM_PAGE_ID, SYNC_CUTOFF_DATE
from app.models import Contact, Conversation, Message, User
from app.auth import get_current_user, require_admin
from datetime import datetime, timedelta

router = APIRouter()


def _verify_signature(raw: bytes, header: str) -> bool:
    """Meta webhook gövdesini X-Hub-Signature-256 (app secret HMAC) ile doğrular.
    INSTAGRAM_APP_SECRET tanımlı değilse doğrulama atlanır (geriye dönük uyum)."""
    from app.config import INSTAGRAM_APP_SECRET
    if not INSTAGRAM_APP_SECRET:
        print("UYARI: INSTAGRAM_APP_SECRET yok — webhook imza doğrulaması atlandı")
        return True
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(INSTAGRAM_APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.split("=", 1)[1])

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


async def _ensure_contact_conv(db, sender_id, platform, preview_text, display_name=None, phone=None):
    """Kişi + konuşmayı bulur/oluşturur; (contact, conversation, is_new) döner.

    İlk mesaj statüsü atama ve aktivite logu mantığını içerir.

    display_name: hazır gelen görünen ad (WhatsApp'ta webhook'tan gelir). Verilmezse
    Instagram için Graph API'den çekilir, diğer platformlar için fallback üretilir.
    phone: kişinin telefon numarası (WhatsApp'ta wa_id = numara).
    """
    from app.models import ActivityLog, Status

    ilk_mesaj_status = db.query(Status).filter(Status.name == "İlk Mesaj").first()

    contact = db.query(Contact).filter(Contact.external_id == sender_id).first()
    is_new = False

    if not contact:
        is_new = True
        if display_name:
            real_name = display_name
        elif platform == "instagram":
            real_name = await get_instagram_username(sender_id)
        else:
            real_name = f"{platform} {sender_id[-6:]}"
        contact = Contact(
            platform=platform,
            external_id=sender_id,
            name=real_name,
            phone=phone,
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


async def _log_ad_referral(db, sender_id, referral):
    """Instagram CTD (Click-to-Direct) reklamından gelen DM'in atıfını ActivityLog'a yazar.

    Webhook `message.referral` nesnesi yalnızca reklamdan gelen sohbetlerde bulunur.
    Bir kişi birden çok reklamdan mesaj atabileceği için her referral ayrı kayıt olur
    (dedup yok). Çağıran taraf webhook retry'lerinde (mid daha önce görüldüyse) bu
    fonksiyonu çağırmaz, böylece aynı referral iki kez yazılmaz.
    """
    from app.models import ActivityLog
    contact = db.query(Contact).filter(Contact.external_id == sender_id).first()
    if not contact:
        return
    ad_ctx = referral.get("ads_context_data") or {}
    ad_title = ad_ctx.get("ad_title")
    ad_id = referral.get("ad_id")
    db.add(ActivityLog(
        contact_id=contact.id,
        type="ad_referral",
        title=f"📢 Reklamdan geldi: {ad_title or 'Reklam'}",
        description=f"Reklam ID: {ad_id}" if ad_id else "Reklam kaynağından gelindi",
        ad_id=ad_id,
        ad_title=ad_title,
        created_at=datetime.utcnow(),
    ))
    db.commit()
    print(f"Reklam atıfı kaydedildi: {sender_id} → {ad_title} ({ad_id})")


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


async def save_message(db, sender_id, text, mid, platform, display_name=None, phone=None):
    contact, conversation, is_new = await _ensure_contact_conv(
        db, sender_id, platform, text, display_name=display_name, phone=phone
    )

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
    conversation.unread_count = Conversation.unread_count + 1  # atomik (eşzamanlı mesajda kaymaz)
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
        conversation.unread_count = Conversation.unread_count + 1  # atomik (eşzamanlı mesajda kaymaz)
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
    if mode == "subscribe" and token == WEBHOOK_VERIFY_TOKEN and challenge and challenge.isdigit():
        return int(challenge)
    return JSONResponse({"error": "Doğrulama başarısız"}, status_code=403)

@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    if not _verify_signature(raw, request.headers.get("X-Hub-Signature-256", "")):
        print("Webhook imza doğrulaması BAŞARISIZ — istek reddedildi")
        return JSONResponse({"error": "imza geçersiz"}, status_code=403)
    try:
        body = json.loads(raw or b"{}")
    except Exception:
        return JSONResponse({"error": "geçersiz gövde"}, status_code=400)
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
                referral = message.get("referral")  # reklamdan (CTD) geldiyse dolu

                # Kendi gönderdiğimiz mesajları atla
                if sender_id == our_id:
                    continue

                # Bu mesajı daha önce işledik mi? (webhook retry → referral'ı tekrar yazma)
                already_seen = bool(mid) and db.query(Message.id).filter(Message.external_id == mid).first() is not None

                if attachments and sender_id:
                    await save_attachments(db, sender_id, attachments, mid, "instagram")
                elif text and sender_id:
                    await save_message(db, sender_id, text, mid, "instagram")
                elif is_unsupported and sender_id:
                    await save_message(db, sender_id, UNSUPPORTED_TEXT, mid, "instagram")

                if referral and sender_id and not already_seen:
                    await _log_ad_referral(db, sender_id, referral)

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
                    referral = message.get("referral")  # reklamdan (CTD) geldiyse dolu

                    # Kendi gönderdiğimiz mesajları atla
                    if sender_id == our_id_change:
                        continue

                    # Bu mesajı daha önce işledik mi? (webhook retry → referral'ı tekrar yazma)
                    already_seen = bool(mid) and db.query(Message.id).filter(Message.external_id == mid).first() is not None

                    if attachments and sender_id:
                        await save_attachments(db, sender_id, attachments, mid, "instagram")
                    elif text and sender_id:
                        await save_message(db, sender_id, text, mid, "instagram")
                    elif is_unsupported and sender_id:
                        await save_message(db, sender_id, UNSUPPORTED_TEXT, mid, "instagram")

                    if referral and sender_id and not already_seen:
                        await _log_ad_referral(db, sender_id, referral)

    elif body.get("object") == "whatsapp_business_account":
        # WhatsApp Cloud API: gövde IG'den tamamen farklı.
        # entry[].changes[].value.messages[]  + value.contacts[] (isim) + value.statuses[] (teslim durumu)
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") != "messages":
                    continue
                value = change.get("value", {})

                # wa_id -> profil adı eşlemesi (gelen mesajda isim ayrı gelir)
                profiles = {}
                for c in value.get("contacts", []):
                    wa_id = c.get("wa_id")
                    if wa_id:
                        profiles[wa_id] = (c.get("profile") or {}).get("name")

                for msg in value.get("messages", []):
                    sender_id = msg.get("from")  # wa_id = telefon numarası
                    mid = msg.get("id")
                    msg_type = msg.get("type")
                    if not sender_id:
                        continue
                    name = profiles.get(sender_id)

                    if msg_type == "text":
                        text = (msg.get("text") or {}).get("body")
                        if text:
                            await save_message(db, sender_id, text, mid, "whatsapp",
                                               display_name=name, phone=sender_id)
                    else:
                        # Medya/konum/etkileşim vb. — gerçek indirme Faz 4'te.
                        await save_message(db, sender_id,
                                           f"📎 Desteklenmeyen içerik ({msg_type})", mid,
                                           "whatsapp", display_name=name, phone=sender_id)

                # value.statuses[] (sent/delivered/read) şimdilik yok sayılıyor.

    return {"status": "ok"}

@router.get("/test-instagram")
async def test_instagram(request: Request, _: User = Depends(require_admin)):
    from app.config import INSTAGRAM_TOKEN
    url = f"https://graph.instagram.com/v19.0/me?fields=id,name&access_token={INSTAGRAM_TOKEN}"
    response = await request.app.state.http.get(url)
    return response.json()

@router.get("/test-whatsapp")
async def test_whatsapp(request: Request, _: User = Depends(require_admin)):
    """WhatsApp token + Phone ID teşhisi (mesaj göndermeden).

    display_phone_number/verified_name dönerse → token + Phone ID geçerli.
    OAuthException/Authentication Error → token sorunu.
    Object ... does not exist → Phone ID sorunu (muhtemelen WABA ID girilmiş).
    """
    from app.config import WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
        return {"error": "WHATSAPP_TOKEN veya WHATSAPP_PHONE_ID Railway'de tanımlı değil",
                "token_set": bool(WHATSAPP_TOKEN), "phone_id_set": bool(WHATSAPP_PHONE_ID)}
    url = (f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_ID}"
           f"?fields=display_phone_number,verified_name,quality_rating")
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    response = await request.app.state.http.get(url, headers=headers)
    return response.json()

@router.get("/test-conversations")
async def test_conversations(request: Request, _: User = Depends(require_admin)):
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
def sync_conversations(request: Request, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.config import INSTAGRAM_TOKEN
    from datetime import timezone
    import dateutil.parser

    # Kesim tarihi: bu tarihten önceki mesajlar atlanır (SYNC_CUTOFF_DATE).
    try:
        start_date = datetime.fromisoformat(SYNC_CUTOFF_DATE)
    except Exception:
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
                if p.get("id") != INSTAGRAM_PAGE_ID:
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
                direction = "outbound" if sender.get("id") == INSTAGRAM_PAGE_ID else "inbound"

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
def backfill_usernames(request: Request, _: User = Depends(require_admin), db: Session = Depends(get_db)):
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

    