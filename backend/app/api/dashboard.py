from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models import (
    User, Status, Contact, Conversation, Message,
    Reminder, ActivityLog, Payment, AdSpend, AdAccount,
)
from app.queries import waiting_conversations_q
from app.utils import iso_utc, serialize_user
from app import tz

router = APIRouter()

# Saat dilimi mantığı app/tz.py'de merkezîleştirildi (İstanbul, sabit UTC+3).
TR_OFFSET_HOURS = 3  # zaman serisi gün-sınırı hesabında kullanılıyor
MAX_TIMESERIES_DAYS = 366  # zaman serisi aralık üst sınırı

_tr_day = tz.tr_day              # naive UTC → İstanbul günü
_today_start_utc = tz.tr_today_start_utc
_month_start_utc = tz.tr_month_start_utc


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
    # Bugün için bekleyen hatırlatmalar (TR saatine göre, RemindersBell ile aynı semantik)
    today_end_utc = today_start + timedelta(days=1)
    active_reminders = (db.query(func.count(Reminder.id))
                        .filter(Reminder.is_done == False,
                                Reminder.remind_at >= today_start,
                                Reminder.remind_at < today_end_utc)
                        .scalar() or 0)

    # Cevap bekleyen konuşma sayısı — ortak helper (app/queries.py).
    waiting_replies = (
        waiting_conversations_q(db).with_entities(func.count(Conversation.id)).scalar()
    ) or 0

    # Bugün reklamla İLK KEZ gelen kişi (ad_referral, is_first_touch) — TR günü.
    ad_first_touch = (db.query(func.count(func.distinct(ActivityLog.contact_id)))
                      .filter(ActivityLog.type == "ad_referral",
                              ActivityLog.is_first_touch == True,
                              ActivityLog.created_at >= today_start,
                              ActivityLog.created_at < today_end_utc)
                      .scalar() or 0)

    today = {
        "incoming_messages": int(incoming),
        "outgoing_messages": int(outgoing),
        "new_contacts": int(new_contacts),
        "active_reminders": int(active_reminders),
        "waiting_replies": int(waiting_replies),
        "ad_first_touch_arrivals": int(ad_first_touch),
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
            "created_by": serialize_user(a.created_by),
            "advisor": a.advisor,
            "created_at": iso_utc(a.created_at),
        })

    return {
        "today": today,
        "this_month": this_month,
        "status_distribution": status_distribution,
        "recent_activity": recent_activity,
    }


def _parse_date(s):
    if not s:
        return None
    try:
        return date.fromisoformat(str(s)[:10])
    except ValueError:
        return None


@router.get("/dashboard/timeseries")
def dashboard_timeseries(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Gün gün: yeni kişi, gelen/giden mesaj, gelir, ödeme gideri, reklam harcaması,
    toplam gider (ödeme + reklam) ve net. Tarihler Türkiye yerel gününe göre gruplanır."""
    to_d = _parse_date(to) or _tr_day(datetime.utcnow())
    from_d = _parse_date(from_) or (to_d - timedelta(days=29))
    if from_d > to_d:
        from_d, to_d = to_d, from_d
    if (to_d - from_d).days > MAX_TIMESERIES_DAYS:
        from_d = to_d - timedelta(days=MAX_TIMESERIES_DAYS)

    # TR günlerini kapsayan UTC penceresi (TR 00:00 = UTC -3saat)
    start_utc = datetime.combine(from_d, datetime.min.time()) - timedelta(hours=TR_OFFSET_HOURS)
    end_utc = datetime.combine(to_d, datetime.max.time()) - timedelta(hours=TR_OFFSET_HOURS)

    days = {}
    d = from_d
    while d <= to_d:
        days[d] = {"new_contacts": 0, "incoming": 0, "outgoing": 0,
                   "payment_expense": 0.0, "ad_spend": 0.0, "income": 0.0}
        d += timedelta(days=1)

    # Yeni kişiler
    for (created,) in db.query(Contact.created_at).filter(
            Contact.created_at >= start_utc, Contact.created_at <= end_utc):
        if created:
            k = _tr_day(created)
            if k in days:
                days[k]["new_contacts"] += 1

    # Mesajlar (gelen/giden)
    for ts, direction in db.query(Message.timestamp, Message.direction).filter(
            Message.timestamp >= start_utc, Message.timestamp <= end_utc):
        if ts:
            k = _tr_day(ts)
            if k in days:
                if direction == "inbound":
                    days[k]["incoming"] += 1
                elif direction == "outbound":
                    days[k]["outgoing"] += 1

    # Ödemeler (gelir / gider)
    for ptype, amount, paid_at in db.query(Payment.type, Payment.amount, Payment.paid_at).filter(
            Payment.paid_at >= start_utc, Payment.paid_at <= end_utc):
        if paid_at:
            k = _tr_day(paid_at)
            if k in days:
                amt = float(amount or 0)
                if ptype == "income":
                    days[k]["income"] += amt
                elif ptype == "expense":
                    days[k]["payment_expense"] += amt

    # Reklam harcaması (sadece Parametreler'de tanımlı hesaplar; AdSpend.date zaten gün)
    ad_rows = (db.query(AdSpend.date, func.coalesce(func.sum(AdSpend.spend), 0))
               .filter(AdSpend.date >= from_d, AdSpend.date <= to_d,
                       AdSpend.account_act_id.in_(select(AdAccount.act_id)))
               .group_by(AdSpend.date).all())
    for dt_, s in ad_rows:
        if dt_ in days:
            days[dt_]["ad_spend"] = float(s or 0)

    series = []
    totals = {"new_contacts": 0, "incoming": 0, "outgoing": 0,
              "payment_expense": 0.0, "ad_spend": 0.0, "income": 0.0,
              "total_expense": 0.0, "net": 0.0}
    for d in sorted(days):
        m = days[d]
        total_expense = round(m["payment_expense"] + m["ad_spend"], 2)
        net = round(m["income"] - total_expense, 2)
        row = {
            "date": d.isoformat(),
            "new_contacts": m["new_contacts"],
            "incoming": m["incoming"],
            "outgoing": m["outgoing"],
            "income": round(m["income"], 2),
            "payment_expense": round(m["payment_expense"], 2),
            "ad_spend": round(m["ad_spend"], 2),
            "total_expense": total_expense,
            "net": net,
        }
        series.append(row)
        for key in ("new_contacts", "incoming", "outgoing"):
            totals[key] += m[key]
        totals["income"] += m["income"]
        totals["payment_expense"] += m["payment_expense"]
        totals["ad_spend"] += m["ad_spend"]
        totals["total_expense"] += total_expense
        totals["net"] += net
    for key in ("income", "payment_expense", "ad_spend", "total_expense", "net"):
        totals[key] = round(totals[key], 2)

    return {
        "range": {"from": from_d.isoformat(), "to": to_d.isoformat()},
        "days": series,
        "totals": totals,
    }
