from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    User, Status, Contact, Conversation, Message,
    Reminder, ActivityLog, Payment,
)
from app.utils import iso_utc

router = APIRouter()

# İstanbul UTC+3 (DST yok). "Bugün" yerel saatte 00:00 → UTC 03:00.
TR_OFFSET_HOURS = 3


def _today_start_utc() -> datetime:
    # Şu anki UTC tarihinden TR saat dilimine göre günün başlangıcı
    now_utc = datetime.utcnow()
    tr_now = now_utc + timedelta(hours=TR_OFFSET_HOURS)
    tr_today_start = tr_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return tr_today_start - timedelta(hours=TR_OFFSET_HOURS)


def _month_start_utc() -> datetime:
    now_utc = datetime.utcnow()
    tr_now = now_utc + timedelta(hours=TR_OFFSET_HOURS)
    tr_month_start = tr_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return tr_month_start - timedelta(hours=TR_OFFSET_HOURS)


@router.get("/dashboard/summary")
def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today_start = _today_start_utc()

    incoming = (db.query(func.count(Message.id))
                .filter(Message.direction == "inbound", Message.timestamp >= today_start)
                .scalar() or 0)
    outgoing = (db.query(func.count(Message.id))
                .filter(Message.direction == "outbound", Message.timestamp >= today_start)
                .scalar() or 0)
    new_contacts = (db.query(func.count(Contact.id))
                    .filter(Contact.created_at >= today_start)
                    .scalar() or 0)
    active_reminders = (db.query(func.count(Reminder.id))
                        .filter(Reminder.is_done == False,
                                Reminder.remind_at <= datetime.utcnow())
                        .scalar() or 0)

    # Cevap bekleyen konuşma sayısı:
    #   - Son mesaj inbound
    #   - reply_dismissed_at NULL veya son mesajdan önce (yani dismiss güncellenmemiş)
    max_msg_subq = (
        db.query(
            Message.conversation_id.label("conv_id"),
            func.max(Message.id).label("max_id"),
        )
        .group_by(Message.conversation_id)
        .subquery()
    )
    waiting_replies = (
        db.query(func.count(Conversation.id))
        .join(max_msg_subq, max_msg_subq.c.conv_id == Conversation.id)
        .join(Message, Message.id == max_msg_subq.c.max_id)
        .filter(
            Message.direction == "inbound",
            or_(
                Conversation.reply_dismissed_at.is_(None),
                Conversation.reply_dismissed_at < Message.timestamp,
            ),
        )
        .scalar()
    ) or 0

    today = {
        "incoming_messages": int(incoming),
        "outgoing_messages": int(outgoing),
        "new_contacts": int(new_contacts),
        "active_reminders": int(active_reminders),
        "waiting_replies": int(waiting_replies),
    }

    # Aylık finansal — sadece admin
    this_month = None
    if current_user.role == "admin":
        month_start = _month_start_utc()
        rows = (db.query(Payment.type, func.coalesce(func.sum(Payment.amount), 0), func.count(Payment.id))
                .filter(Payment.paid_at >= month_start)
                .group_by(Payment.type)
                .all())
        income = expense = 0.0
        payment_count = 0
        for ptype, total, cnt in rows:
            payment_count += int(cnt)
            if ptype == "income":
                income = float(total)
            elif ptype == "expense":
                expense = float(total)
        this_month = {
            "income": income,
            "expense": expense,
            "net": income - expense,
            "payment_count": payment_count,
        }

    # Statü dağılımı
    status_rows = (db.query(Status.id, Status.name, Status.color,
                            func.count(Contact.id).label("cnt"))
                   .outerjoin(Contact, Contact.status_id == Status.id)
                   .filter(Status.is_active == True)
                   .group_by(Status.id, Status.name, Status.color)
                   .order_by(func.count(Contact.id).desc(), Status.id.asc())
                   .all())
    status_distribution = [
        {"id": sid, "name": name, "color": color, "count": int(cnt or 0)}
        for sid, name, color, cnt in status_rows
    ]

    # Son aktiviteler (15)
    activities = (db.query(ActivityLog)
                  .options(joinedload(ActivityLog.created_by),
                           joinedload(ActivityLog.contact))
                  .order_by(ActivityLog.created_at.desc())
                  .limit(15)
                  .all())
    recent_activity = []
    for a in activities:
        recent_activity.append({
            "id": a.id,
            "type": a.type,
            "title": a.title,
            "description": a.description,
            "contact": {"id": a.contact.id, "name": a.contact.full_name or a.contact.name} if a.contact else None,
            "created_by": {
                "id": a.created_by.id,
                "full_name": a.created_by.full_name,
                "username": a.created_by.username,
            } if a.created_by else None,
            "advisor": a.advisor,
            "created_at": iso_utc(a.created_at),
        })

    return {
        "today": today,
        "this_month": this_month,
        "status_distribution": status_distribution,
        "recent_activity": recent_activity,
    }
