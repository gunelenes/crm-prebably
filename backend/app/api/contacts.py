import re
from typing import Optional
from fastapi import APIRouter, Depends, Body
from sqlalchemy import func, desc, asc, or_
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Contact, ActivityLog, Reminder, Status, Conversation, Message, User, ContactLink
from app.auth import get_current_user
from app.utils import iso_utc
from datetime import datetime

router = APIRouter()


# --- Hesap eşleştirme (IG ↔ WhatsApp) yardımcıları ---

def _get_link_row(db, contact_id):
    """Bu kişinin dahil olduğu ContactLink satırını döner (yoksa None)."""
    return db.query(ContactLink).filter(
        or_(ContactLink.contact_a_id == contact_id, ContactLink.contact_b_id == contact_id)
    ).first()


def _linked_other_id(link, contact_id):
    if not link:
        return None
    return link.contact_b_id if link.contact_a_id == contact_id else link.contact_a_id


def _last_conversation_id(db, contact_id):
    conv = (db.query(Conversation)
            .filter(Conversation.contact_id == contact_id)
            .order_by(Conversation.last_message_at.desc().nullslast())
            .first())
    return conv.id if conv else None


def _linked_contact_summary(db, contact_id):
    """Bağlı kişinin özetini döner: {id, platform, name, full_name, last_conversation_id} | None."""
    other_id = _linked_other_id(_get_link_row(db, contact_id), contact_id)
    if not other_id:
        return None
    other = db.query(Contact).filter(Contact.id == other_id).first()
    if not other:
        return None
    return {
        "id": other.id,
        "platform": other.platform,
        "name": other.name,
        "full_name": other.full_name,
        "last_conversation_id": _last_conversation_id(db, other.id),
    }


def _norm_phone(p):
    """Telefonu son 10 haneye indirger (ülke kodu/format farklarını tolere eder)."""
    digits = "".join(ch for ch in (p or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def _name_tokens(c):
    s = f"{c.name or ''} {c.full_name or ''}".lower()
    return [t for t in re.split(r"[^0-9a-zçğıöşü]+", s) if len(t) >= 3]


def _all_linked_ids(db):
    ids = set()
    for l in db.query(ContactLink.contact_a_id, ContactLink.contact_b_id).all():
        ids.add(l[0]); ids.add(l[1])
    return ids


# --- Birleşik profil (v2): kanonik kayıt çözümlemesi ---

def _canonical_id(db, contact_id):
    """Bağlı çiftte 'ana' kaydı döner. Bağlı değilse contact_id'nin kendisi.
    primary_contact_id boşsa fallback: Instagram olan, o da yoksa contact_a_id."""
    link = _get_link_row(db, contact_id)
    if not link:
        return contact_id
    if link.primary_contact_id in (link.contact_a_id, link.contact_b_id):
        return link.primary_contact_id
    a = db.query(Contact).filter(Contact.id == link.contact_a_id).first()
    if a and a.platform == "instagram":
        return a.id
    b = db.query(Contact).filter(Contact.id == link.contact_b_id).first()
    if b and b.platform == "instagram":
        return b.id
    return link.contact_a_id


def _group_ids(db, contact_id):
    """Bu kişiyle birleşik gruptaki tüm contact id'leri (bağlı değilse tek eleman)."""
    link = _get_link_row(db, contact_id)
    if not link:
        return [contact_id]
    return [link.contact_a_id, link.contact_b_id]


def _channels(db, contact_id):
    """Gruptaki tüm kanalların özetini döner (ana olan is_primary=True)."""
    ids = _group_ids(db, contact_id)
    primary = _canonical_id(db, contact_id)
    out = []
    for cid in ids:
        c = db.query(Contact).filter(Contact.id == cid).first()
        if c:
            out.append({
                "id": c.id,
                "platform": c.platform,
                "name": c.name,
                "full_name": c.full_name,
                "last_conversation_id": _last_conversation_id(db, c.id),
                "is_primary": c.id == primary,
            })
    return out

@router.get("/contacts/search")
def search_contacts(
    q: str = "",
    status_id: Optional[int] = None,
    sector_id: Optional[int] = None,
    training_set_id: Optional[int] = None,
    assigned_to: Optional[str] = None,
    purchased: Optional[bool] = None,
    purchase_potential: Optional[str] = None,
    waiting_for_reply: Optional[bool] = None,
    platform: Optional[str] = None,
    sort_by: str = "last_message_at",
    sort_dir: str = "desc",
    limit: int = 50,
    offset: int = 0,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    # contact id → en son conversation (last_message_at + conv id)
    last_conv_subq = (
        db.query(
            Conversation.contact_id.label("contact_id"),
            func.max(Conversation.last_message_at).label("last_msg_at"),
            func.max(Conversation.id).label("conv_id"),
        )
        .group_by(Conversation.contact_id)
        .subquery()
    )

    base_query = (
        db.query(Contact, last_conv_subq.c.last_msg_at, last_conv_subq.c.conv_id)
        .outerjoin(last_conv_subq, last_conv_subq.c.contact_id == Contact.id)
        .options(
            joinedload(Contact.status),
            joinedload(Contact.sector),
            joinedload(Contact.training_set),
        )
    )

    if q:
        like = f"%{q}%"
        base_query = base_query.filter(
            (Contact.name.ilike(like)) |
            (Contact.full_name.ilike(like)) |
            (Contact.phone.ilike(like)) |
            (Contact.email.ilike(like))
        )
    if status_id:
        base_query = base_query.filter(Contact.status_id == status_id)
    if sector_id:
        base_query = base_query.filter(Contact.sector_id == sector_id)
    if training_set_id:
        base_query = base_query.filter(Contact.training_set_id == training_set_id)
    if assigned_to:
        base_query = base_query.filter(Contact.assigned_to.ilike(f"%{assigned_to}%"))
    if purchased is not None:
        base_query = base_query.filter(Contact.purchased == purchased)
    if purchase_potential:
        base_query = base_query.filter(Contact.purchase_potential == purchase_potential)
    if platform in ("instagram", "whatsapp"):
        base_query = base_query.filter(Contact.platform == platform)

    if waiting_for_reply is not None:
        # Cevap bekleyen contact'lar:
        # En az bir conversation'ında son mesaj inbound + dismiss edilmemiş
        max_msg_subq = (
            db.query(
                Message.conversation_id.label("conv_id"),
                func.max(Message.id).label("max_id"),
            )
            .group_by(Message.conversation_id)
            .subquery()
        )
        waiting_contact_ids = (
            db.query(Conversation.contact_id)
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
            base_query = base_query.filter(Contact.id.in_(waiting_contact_ids))
        else:
            base_query = base_query.filter(~Contact.id.in_(waiting_contact_ids))

    # Sıralama
    direction = desc if sort_dir != "asc" else asc
    if sort_by == "name":
        base_query = base_query.order_by(direction(func.coalesce(Contact.full_name, Contact.name)))
    elif sort_by == "created_at":
        base_query = base_query.order_by(direction(Contact.created_at))
    else:  # last_message_at — NULL'lar sona
        if sort_dir == "asc":
            base_query = base_query.order_by(last_conv_subq.c.last_msg_at.asc().nullslast())
        else:
            base_query = base_query.order_by(last_conv_subq.c.last_msg_at.desc().nullslast())

    # Toplam sayım (filtre uygulanmış, sayfalama uygulanmamış)
    total = base_query.with_entities(func.count(Contact.id)).order_by(None).scalar() or 0

    rows = base_query.limit(limit).offset(offset).all()

    # last_message_preview için batch fetch
    conv_ids = [r[2] for r in rows if r[2] is not None]
    last_msg_by_conv = {}
    if conv_ids:
        subq = (
            db.query(
                Message.conversation_id,
                func.max(Message.id).label("max_id"),
            )
            .filter(Message.conversation_id.in_(conv_ids))
            .group_by(Message.conversation_id)
            .subquery()
        )
        msgs = (
            db.query(Message)
            .join(subq, Message.id == subq.c.max_id)
            .all()
        )
        last_msg_by_conv = {m.conversation_id: m.content for m in msgs}

    items = []
    for contact, last_msg_at, conv_id in rows:
        preview = last_msg_by_conv.get(conv_id)
        if preview and len(preview) > 80:
            preview = preview[:80] + "…"
        items.append({
            "id": contact.id,
            "name": contact.name,
            "full_name": contact.full_name,
            "phone": contact.phone,
            "email": contact.email,
            "platform": contact.platform,
            "assigned_to": contact.assigned_to,
            "purchase_potential": contact.purchase_potential,
            "purchased": contact.purchased,
            "had_training": contact.had_training,
            "knows_us": contact.knows_us,
            "status": {"id": contact.status.id, "name": contact.status.name, "color": contact.status.color} if contact.status else None,
            "sector": {"id": contact.sector.id, "name": contact.sector.name} if contact.sector else None,
            "training_set": {"id": contact.training_set.id, "name": contact.training_set.name} if contact.training_set else None,
            "last_message_at": iso_utc(last_msg_at),
            "last_message_preview": preview,
            "last_conversation_id": conv_id,
            "created_at": iso_utc(contact.created_at),
        })

    return {"total": int(total), "items": items}

@router.get("/reminders/active")
def get_active_reminders(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    reminders = (db.query(Reminder)
                 .options(joinedload(Reminder.advisor_user),
                          joinedload(Reminder.contact))
                 .filter(Reminder.is_done == False, Reminder.remind_at <= now)
                 .all())
    return [{
        "id": r.id,
        "contact_id": r.contact_id,
        "contact_name": (r.contact.full_name or r.contact.name) if r.contact else None,
        "title": r.title,
        "remind_at": iso_utc(r.remind_at),
        "advisor_user": {"id": r.advisor_user.id, "full_name": r.advisor_user.full_name, "username": r.advisor_user.username} if r.advisor_user else None,
    } for r in reminders]


@router.get("/reminders/search")
def search_reminders(
    advisor_user_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    status: str = "all",          # 'pending' | 'done' | 'all'
    scope: str = "all",            # 'today' | 'upcoming' | 'overdue' | 'all'
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_dir: str = "asc",
    limit: int = 200,
    offset: int = 0,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from datetime import timedelta
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))

    q = (db.query(Reminder)
         .options(joinedload(Reminder.advisor_user),
                  joinedload(Reminder.contact),
                  joinedload(Reminder.created_by)))

    if advisor_user_id:
        q = q.filter(Reminder.advisor_user_id == advisor_user_id)
    if contact_id:
        q = q.filter(Reminder.contact_id == contact_id)

    if status == "pending":
        q = q.filter(Reminder.is_done == False)
    elif status == "done":
        q = q.filter(Reminder.is_done == True)

    now = datetime.utcnow()
    tr_now = now + timedelta(hours=3)
    tr_today_start = tr_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = tr_today_start - timedelta(hours=3)
    today_end_utc = today_start_utc + timedelta(days=1)

    if scope == "today":
        q = q.filter(Reminder.remind_at >= today_start_utc, Reminder.remind_at < today_end_utc)
    elif scope == "upcoming":
        q = q.filter(Reminder.remind_at >= now)
    elif scope == "overdue":
        q = q.filter(Reminder.remind_at < now, Reminder.is_done == False)

    if date_from:
        try: q = q.filter(Reminder.remind_at >= datetime.fromisoformat(date_from.replace("Z", "")))
        except: pass
    if date_to:
        try: q = q.filter(Reminder.remind_at <= datetime.fromisoformat(date_to.replace("Z", "")))
        except: pass

    total = q.with_entities(func.count(Reminder.id)).order_by(None).scalar() or 0

    direction = desc if sort_dir == "desc" else asc
    q = q.order_by(direction(Reminder.remind_at))

    rows = q.limit(limit).offset(offset).all()
    items = [{
        "id": r.id,
        "contact_id": r.contact_id,
        "contact_name": (r.contact.full_name or r.contact.name) if r.contact else None,
        "title": r.title,
        "description": r.description,
        "remind_at": iso_utc(r.remind_at),
        "is_done": r.is_done,
        "advisor_user": {"id": r.advisor_user.id, "full_name": r.advisor_user.full_name, "username": r.advisor_user.username} if r.advisor_user else None,
        "created_by": {"id": r.created_by.id, "full_name": r.created_by.full_name, "username": r.created_by.username} if r.created_by else None,
        "created_at": iso_utc(r.created_at),
    } for r in rows]

    return {"total": int(total), "items": items}


@router.get("/reminders/today")
def get_today_reminders(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Bugüne (TR saatine göre) ait tüm hatırlatmalar — tamamlanmış olsun olmasın, saat sırasına göre."""
    from datetime import timedelta
    tr_now = datetime.utcnow() + timedelta(hours=3)
    tr_today_start = tr_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = tr_today_start - timedelta(hours=3)
    today_end_utc = today_start_utc + timedelta(days=1)

    reminders = (db.query(Reminder)
                 .options(joinedload(Reminder.advisor_user),
                          joinedload(Reminder.contact))
                 .filter(Reminder.remind_at >= today_start_utc,
                         Reminder.remind_at < today_end_utc)
                 .order_by(Reminder.remind_at.asc())
                 .all())
    return [{
        "id": r.id,
        "contact_id": r.contact_id,
        "contact_name": (r.contact.full_name or r.contact.name) if r.contact else None,
        "title": r.title,
        "description": r.description,
        "remind_at": iso_utc(r.remind_at),
        "is_done": r.is_done,
        "advisor_user": {"id": r.advisor_user.id, "full_name": r.advisor_user.full_name, "username": r.advisor_user.username} if r.advisor_user else None,
    } for r in reminders]

@router.put("/contacts/{contact_id}/status")
def update_contact_status(contact_id: int, body: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        print(f"Status güncelleme: contact_id={contact_id}, body={body}, user={current_user.id}")

        contact_id = _canonical_id(db, contact_id)  # birleşik profil: kanoniğe yaz
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            return {"error": "Bulunamadı"}

        old_status_id = contact.status_id
        new_status_id = body.get("status_id")
        advisor_user_id = body.get("advisor_user_id") or current_user.id
        note = body.get("note", "")

        contact.status_id = new_status_id

        old_status = db.query(Status).filter(Status.id == old_status_id).first() if old_status_id else None
        new_status = db.query(Status).filter(Status.id == new_status_id).first() if new_status_id else None

        log = ActivityLog(
            contact_id=contact_id,
            type="status_change",
            title=f"Statü değiştirildi: {old_status.name if old_status else 'Yok'} → {new_status.name if new_status else 'Yok'}",
            description=note,
            old_status_id=old_status_id,
            new_status_id=new_status_id,
            advisor_user_id=advisor_user_id,
            created_at=datetime.utcnow(),
            created_by_user_id=current_user.id,
        )
        db.add(log)
        db.commit()
        print(f"Log kaydedildi: contact_id={contact_id}")
        return {"status": "ok"}
    except Exception as e:
        print(f"HATA: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@router.put("/contacts/{contact_id}/reminders/{reminder_id}/done")
def mark_reminder_done(contact_id: int, reminder_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        return {"error": "Bulunamadı"}
    reminder.is_done = True
    db.commit()
    return {"status": "ok"}

@router.put("/contacts/{contact_id}/reminders/{reminder_id}")
def update_reminder(contact_id: int, reminder_id: int, body: dict = Body(...), _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        return {"error": "Bulunamadı"}
    if "title" in body and body["title"]:
        reminder.title = body["title"]
    if "description" in body:
        reminder.description = body["description"]
    if "remind_at" in body and body["remind_at"]:
        try:
            reminder.remind_at = datetime.fromisoformat(body["remind_at"])
        except Exception:
            return {"error": "Geçersiz tarih"}
    if "advisor_user_id" in body:
        reminder.advisor_user_id = body["advisor_user_id"] or None
    if "is_done" in body:
        reminder.is_done = bool(body["is_done"])
    db.commit()
    return {"status": "ok"}

@router.delete("/contacts/{contact_id}/reminders/{reminder_id}")
def delete_reminder(contact_id: int, reminder_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        return {"error": "Bulunamadı"}
    db.delete(reminder)
    db.commit()
    return {"status": "ok"}

@router.get("/contacts/{contact_id}")
def get_contact(contact_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Birleşik profil: hangi kanal açılırsa açılsın KANONİK kaydın profili gösterilir.
    requested_id = contact_id
    linked = _get_link_row(db, requested_id)
    canonical = _canonical_id(db, requested_id)
    contact = (db.query(Contact)
               .options(joinedload(Contact.status),
                        joinedload(Contact.sector),
                        joinedload(Contact.training_set),
                        joinedload(Contact.assigned_to_user))
               .filter(Contact.id == canonical)
               .first())
    if not contact:
        return {"error": "Bulunamadı"}

    # Telefon/e-posta kanonikte boşsa diğer kanaldan doldur (görüntü kolaylığı).
    phone, email = contact.phone, contact.email
    if linked and (not phone or not email):
        for cid in _group_ids(db, requested_id):
            if cid == contact.id:
                continue
            other = db.query(Contact).filter(Contact.id == cid).first()
            if other:
                phone = phone or other.phone
                email = email or other.email

    return {
        "id": contact.id,
        "name": contact.name,
        "full_name": contact.full_name,
        "phone": phone,
        "email": email,
        "platform": contact.platform,
        "external_id": contact.external_id,
        "description": contact.description,
        "knows_us": contact.knows_us,
        "previous_trainings": contact.previous_trainings,
        "purchase_potential": contact.purchase_potential,
        "had_training": contact.had_training,
        "purchased": contact.purchased,
        "reason_not_purchased": contact.reason_not_purchased,
        "status_id": contact.status_id,
        "status": {"id": contact.status.id, "name": contact.status.name, "color": contact.status.color} if contact.status else None,
        "sector_id": contact.sector_id,
        "sector": {"id": contact.sector.id, "name": contact.sector.name} if contact.sector else None,
        "training_set_id": contact.training_set_id,
        "training_set": {"id": contact.training_set.id, "name": contact.training_set.name} if contact.training_set else None,
        "assigned_to_user_id": contact.assigned_to_user_id,
        "assigned_to_user": {"id": contact.assigned_to_user.id, "full_name": contact.assigned_to_user.full_name, "username": contact.assigned_to_user.username} if contact.assigned_to_user else None,
        "created_at": iso_utc(contact.created_at),
        "linked_contact": _linked_contact_summary(db, requested_id),
        "channels": _channels(db, requested_id),
        "primary_contact_id": canonical if linked else None,
    }

@router.put("/contacts/{contact_id}")
def update_contact(contact_id: int, body: dict = Body(...), _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact_id = _canonical_id(db, contact_id)  # birleşik profil: kanoniğe yaz
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        return {"error": "Bulunamadı"}
    fields = ["full_name", "phone", "email", "description", "knows_us",
              "previous_trainings", "purchase_potential",
              "had_training", "purchased", "reason_not_purchased",
              "sector_id", "training_set_id", "assigned_to_user_id"]
    for field in fields:
        if field in body:
            value = body[field]
            # Boş string FK için NULL'a çevir
            if field in ("sector_id", "training_set_id", "assigned_to_user_id") and (value == "" or value == 0):
                value = None
            setattr(contact, field, value)
    db.commit()
    return {"status": "ok"}


def _suggestion_dict(db, c, reasons):
    return {
        "id": c.id,
        "platform": c.platform,
        "name": c.name,
        "full_name": c.full_name,
        "phone": c.phone,
        "last_conversation_id": _last_conversation_id(db, c.id),
        "reason": ", ".join(reasons) if reasons else None,
    }


@router.get("/contacts/{contact_id}/match-suggestions")
def match_suggestions(contact_id: int, q: Optional[str] = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Bu kişiyle eşleştirilebilecek KARŞI platform kişilerini önerir.
    q verilirse arama yapar; verilmezse telefon/isim benzerliğine göre otomatik önerir."""
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        return {"error": "Bulunamadı"}
    if _get_link_row(db, contact_id):
        return []  # zaten bağlı; tek bağ kuralı

    linked_ids = _all_linked_ids(db)
    base = db.query(Contact).filter(
        Contact.platform != contact.platform,
        Contact.id != contact_id,
    )
    if linked_ids:
        base = base.filter(~Contact.id.in_(linked_ids))

    # Serbest arama
    if q and q.strip():
        like = f"%{q.strip()}%"
        rows = base.filter(or_(
            Contact.name.ilike(like),
            Contact.full_name.ilike(like),
            Contact.phone.ilike(like),
        )).limit(20).all()
        return [_suggestion_dict(db, c, ["Arama"]) for c in rows]

    # Otomatik öneri: telefon (son 10 hane) ve isim token örtüşmesi
    my_phone = _norm_phone(contact.phone)
    my_tokens = set(_name_tokens(contact))
    scored = []
    for c in base.all():
        score = 0
        reasons = []
        if my_phone and _norm_phone(c.phone) == my_phone:
            score += 100
            reasons.append("Aynı telefon")
        if my_tokens and (my_tokens & set(_name_tokens(c))):
            score += 10
            reasons.append("Benzer isim")
        if score > 0:
            scored.append((score, c, reasons))
    scored.sort(key=lambda x: -x[0])
    return [_suggestion_dict(db, c, reasons) for _s, c, reasons in scored[:10]]


@router.post("/contacts/{contact_id}/link")
def link_contact(contact_id: int, body: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """İki kişiyi 'aynı kişi' olarak eşler (farklı platform şart, ikisi de bağsız olmalı)."""
    other_id = body.get("other_contact_id")
    if not other_id:
        return {"error": "Eşleştirilecek kişi seçilmedi"}
    if other_id == contact_id:
        return {"error": "Bir kişi kendisiyle eşleştirilemez"}
    a = db.query(Contact).filter(Contact.id == contact_id).first()
    b = db.query(Contact).filter(Contact.id == other_id).first()
    if not a or not b:
        return {"error": "Kişi bulunamadı"}
    if a.platform == b.platform:
        return {"error": "Aynı platformdaki kişiler eşleştirilemez (farklı kanal olmalı)"}
    if _get_link_row(db, a.id) or _get_link_row(db, b.id):
        return {"error": "Kişilerden biri zaten başka bir hesaba bağlı"}

    # Ana (kanonik) profil: kullanıcı seçer; geçersiz/boşsa Instagram olanı varsayılan yap.
    primary = body.get("primary_contact_id")
    if primary not in (a.id, b.id):
        primary = a.id if a.platform == "instagram" else (b.id if b.platform == "instagram" else a.id)

    lo, hi = sorted([a.id, b.id])
    db.add(ContactLink(contact_a_id=lo, contact_b_id=hi, primary_contact_id=primary, created_by_user_id=current_user.id))
    for c, other in ((a, b), (b, a)):
        icon = "💬" if other.platform == "whatsapp" else "📸"
        db.add(ActivityLog(
            contact_id=c.id,
            type="link",
            title=f"{icon} Hesap bağlandı: {other.full_name or other.name}",
            description=f"{other.platform} hesabıyla eşleştirildi",
            created_by_user_id=current_user.id,
            created_at=datetime.utcnow(),
        ))
    db.commit()
    return {"status": "ok"}


@router.delete("/contacts/{contact_id}/link")
def unlink_contact(contact_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = _get_link_row(db, contact_id)
    if not link:
        return {"error": "Bağlı hesap yok"}
    other_id = _linked_other_id(link, contact_id)
    db.delete(link)
    for cid in (contact_id, other_id):
        if cid:
            db.add(ActivityLog(
                contact_id=cid,
                type="unlink",
                title="🔗 Hesap bağlantısı kaldırıldı",
                created_by_user_id=current_user.id,
                created_at=datetime.utcnow(),
            ))
    db.commit()
    return {"status": "ok"}

@router.get("/contacts/{contact_id}/activity")
def get_activity(contact_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = (db.query(ActivityLog)
            .options(joinedload(ActivityLog.created_by),
                     joinedload(ActivityLog.advisor_user))
            .filter(ActivityLog.contact_id.in_(_group_ids(db, contact_id)))  # birleşik: grup
            .order_by(ActivityLog.created_at.desc())
            .all())
    return [{
        "id": l.id,
        "type": l.type,
        "title": l.title,
        "description": l.description,
        "advisor_user": {"id": l.advisor_user.id, "full_name": l.advisor_user.full_name, "username": l.advisor_user.username} if l.advisor_user else None,
        "created_at": iso_utc(l.created_at),
        "created_by": {"id": l.created_by.id, "full_name": l.created_by.full_name, "username": l.created_by.username} if l.created_by else None,
    } for l in logs]

@router.get("/contacts/{contact_id}/reminders")
def get_reminders(contact_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reminders = (db.query(Reminder)
                 .options(joinedload(Reminder.created_by),
                          joinedload(Reminder.advisor_user))
                 .filter(Reminder.contact_id.in_(_group_ids(db, contact_id)))  # birleşik: grup
                 .order_by(Reminder.remind_at.asc())
                 .all())
    return [{
        "id": r.id,
        "title": r.title,
        "description": r.description,
        "remind_at": iso_utc(r.remind_at),
        "is_done": r.is_done,
        "advisor_user": {"id": r.advisor_user.id, "full_name": r.advisor_user.full_name, "username": r.advisor_user.username} if r.advisor_user else None,
        "created_at": iso_utc(r.created_at),
        "created_by": {"id": r.created_by.id, "full_name": r.created_by.full_name, "username": r.created_by.username} if r.created_by else None,
    } for r in reminders]

@router.post("/contacts/{contact_id}/reminders")
def create_reminder(contact_id: int, body: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact_id = _canonical_id(db, contact_id)  # birleşik profil: kanoniğe bağla
    advisor_user_id = body.get("advisor_user_id") or current_user.id
    reminder = Reminder(
        contact_id=contact_id,
        title=body.get("title"),
        description=body.get("description"),
        remind_at=datetime.fromisoformat(body.get("remind_at")),
        advisor_user_id=advisor_user_id,
        created_by_user_id=current_user.id,
    )
    db.add(reminder)
    log = ActivityLog(
        contact_id=contact_id,
        type="reminder",
        title=f"Hatırlatma oluşturuldu: {body.get('title')}",
        description=body.get("description"),
        advisor_user_id=advisor_user_id,
        created_at=datetime.utcnow(),
        created_by_user_id=current_user.id,
    )
    db.add(log)
    db.commit()
    print(f"Hatırlatma kaydedildi: contact_id={contact_id}")
    return {"status": "ok", "id": reminder.id}