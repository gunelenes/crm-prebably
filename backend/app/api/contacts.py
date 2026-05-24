from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Contact, ActivityLog, Reminder, Status
from datetime import datetime

router = APIRouter()

@router.get("/contacts/search")
def search_contacts(q: str = "", status_id: int = None, db: Session = Depends(get_db)):
    query = db.query(Contact)
    if q:
        query = query.filter(
            (Contact.name.ilike(f"%{q}%")) |
            (Contact.full_name.ilike(f"%{q}%")) |
            (Contact.phone.ilike(f"%{q}%"))
        )
    if status_id:
        query = query.filter(Contact.status_id == status_id)
    contacts = query.limit(20).all()
    return [{
        "id": c.id,
        "name": c.name,
        "full_name": c.full_name,
        "phone": c.phone,
        "platform": c.platform,
        "status": {"id": c.status.id, "name": c.status.name, "color": c.status.color} if c.status else None,
    } for c in contacts]

@router.get("/reminders/active")
def get_active_reminders(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    reminders = db.query(Reminder).filter(
        Reminder.is_done == False,
        Reminder.remind_at <= now
    ).all()
    return [{
        "id": r.id,
        "contact_id": r.contact_id,
        "title": r.title,
        "remind_at": str(r.remind_at),
        "advisor": r.advisor
    } for r in reminders]

@router.put("/contacts/{contact_id}/status")
def update_contact_status(contact_id: int, body: dict = Body(...), db: Session = Depends(get_db)):
    try:
        print(f"Status güncelleme: contact_id={contact_id}, body={body}")

        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            return {"error": "Bulunamadı"}

        old_status_id = contact.status_id
        new_status_id = body.get("status_id")
        advisor = body.get("advisor", "")
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
            advisor=advisor,
            created_at=datetime.utcnow()
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
def mark_reminder_done(contact_id: int, reminder_id: int, db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        return {"error": "Bulunamadı"}
    reminder.is_done = True
    db.commit()
    return {"status": "ok"}

@router.get("/contacts/{contact_id}")
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        return {"error": "Bulunamadı"}
    return {
        "id": contact.id,
        "name": contact.name,
        "full_name": contact.full_name,
        "phone": contact.phone,
        "platform": contact.platform,
        "external_id": contact.external_id,
        "sector": contact.sector,
        "description": contact.description,
        "knows_us": contact.knows_us,
        "previous_trainings": contact.previous_trainings,
        "source_video": contact.source_video,
        "purchase_potential": contact.purchase_potential,
        "had_training": contact.had_training,
        "purchased": contact.purchased,
        "reason_not_purchased": contact.reason_not_purchased,
        "assigned_to": contact.assigned_to,
        "status_id": contact.status_id,
        "status": {"id": contact.status.id, "name": contact.status.name, "color": contact.status.color} if contact.status else None,
        "created_at": str(contact.created_at),
    }

@router.put("/contacts/{contact_id}")
def update_contact(contact_id: int, body: dict = Body(...), db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        return {"error": "Bulunamadı"}
    fields = ["full_name", "phone", "sector", "description", "knows_us",
              "previous_trainings", "source_video", "purchase_potential",
              "had_training", "purchased", "reason_not_purchased", "assigned_to"]
    for field in fields:
        if field in body:
            setattr(contact, field, body[field])
    db.commit()
    return {"status": "ok"}

@router.get("/contacts/{contact_id}/activity")
def get_activity(contact_id: int, db: Session = Depends(get_db)):
    logs = db.query(ActivityLog).filter(
        ActivityLog.contact_id == contact_id
    ).order_by(ActivityLog.created_at.desc()).all()
    return [{
        "id": l.id,
        "type": l.type,
        "title": l.title,
        "description": l.description,
        "advisor": l.advisor,
        "created_at": str(l.created_at)
    } for l in logs]

@router.get("/contacts/{contact_id}/reminders")
def get_reminders(contact_id: int, db: Session = Depends(get_db)):
    reminders = db.query(Reminder).filter(
        Reminder.contact_id == contact_id
    ).order_by(Reminder.remind_at.asc()).all()
    return [{
        "id": r.id,
        "title": r.title,
        "description": r.description,
        "remind_at": str(r.remind_at),
        "is_done": r.is_done,
        "advisor": r.advisor,
        "created_at": str(r.created_at)
    } for r in reminders]

@router.post("/contacts/{contact_id}/reminders")
def create_reminder(contact_id: int, body: dict = Body(...), db: Session = Depends(get_db)):
    reminder = Reminder(
        contact_id=contact_id,
        title=body.get("title"),
        description=body.get("description"),
        remind_at=datetime.fromisoformat(body.get("remind_at")),
        advisor=body.get("advisor"),
    )
    db.add(reminder)
    log = ActivityLog(
        contact_id=contact_id,
        type="reminder",
        title=f"Hatırlatma oluşturuldu: {body.get('title')}",
        description=body.get("description"),
        advisor=body.get("advisor"),
        created_at=datetime.utcnow()
    )
    db.add(log)
    db.commit()
    print(f"Hatırlatma kaydedildi: contact_id={contact_id}")
    return {"status": "ok", "id": reminder.id}