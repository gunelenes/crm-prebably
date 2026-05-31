"""Reklam Analizi — Meta (Instagram/Facebook) reklam harcaması + Wix kayıtları.

Salt görüntüleme odaklı: reklamlar CRM'de yönetilmez. Harcama Meta Marketing
(Insights) API'sinden okunur; reklam hesapları .env'de (META_AD_ACCOUNTS) tanımlı
değilse token'dan otomatik keşfedilir. Wix seminer kayıtları CSV ile yüklenir.
"""
import csv
import io
import json
import hashlib
from datetime import datetime, date, timedelta
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import APIRouter, Depends, Body, File, UploadFile, HTTPException, Request, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdAccount, AdSpend, Registration, Contact, User
from app.auth import require_admin
from app.utils import iso_utc
from app import config

router = APIRouter()

MAX_CSV_SIZE = 5 * 1024 * 1024  # 5 MB

# Meta'nın "başlatılan mesajlaşma konuşması" action_type'ları (sürümlere göre öncelik sırası)
MESSAGING_ACTION_TYPES = [
    "onsite_conversion.messaging_conversation_started_7d",
    "onsite_conversion.total_messaging_connection",
    "messaging_conversation_started_7d",
]

# CSV başlık eşleme (normalize edilmiş → alan)
HEADER_MAP = {
    "name": {"ad", "isim", "ad soyad", "adı soyadı", "ad soyadı", "adsoyad",
             "isim soyisim", "ad-soyad", "name", "full name", "fullname"},
    "email": {"e-posta", "eposta", "e posta", "email", "e-mail", "e mail", "mail"},
    "phone": {"telefon", "tel", "gsm", "cep", "cep telefonu", "telefon no",
              "phone", "mobile", "phone number"},
    "seminar": {"seminer", "etkinlik", "eğitim", "egitim", "seminar", "event"},
    "registered_at": {"tarih", "kayıt tarihi", "kayit tarihi", "date", "created",
                      "created at", "submission time", "oluşturulma", "oluşturma tarihi"},
}


# ----------------------------- yardımcılar -----------------------------

def _norm_email(s: Optional[str]) -> Optional[str]:
    return (s or "").strip().lower() or None


def _norm_phone(s: Optional[str]) -> Optional[str]:
    digits = "".join(ch for ch in (s or "") if ch.isdigit())
    if not digits:
        return None
    # Türkiye: 90 ülke kodunu at, son 10 haneyi tut
    if len(digits) > 10:
        digits = digits[-10:]
    return digits


def _norm_header(h: Optional[str]) -> str:
    return (h or "").replace("﻿", "").strip().lower()


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(str(s)[:10])
    except ValueError:
        return None


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    s = str(s).strip()
    try:
        return datetime.fromisoformat(s.replace("Z", ""))
    except ValueError:
        pass
    try:
        from dateutil import parser as _p
        return _p.parse(s, dayfirst=True)  # TR formatı: gün.ay.yıl
    except Exception:
        return None


def _dedup_key(email, phone, seminar, reg_dt) -> Optional[str]:
    basis = "|".join([
        email or "",
        phone or "",
        (seminar or "").strip().lower(),
        reg_dt.date().isoformat() if reg_dt else "",
    ])
    if not basis.strip("|"):
        return None
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()[:40]


def _default_channel_for_purpose(purpose: str) -> str:
    return {"ig_dm": "instagram", "wa_dm": "whatsapp"}.get(purpose, "other")


def _classify_channel(default_channel: str, adset_name, campaign_name) -> str:
    text = f"{adset_name or ''} {campaign_name or ''}".lower()
    if "whatsapp" in text or "wp" in text:
        return "whatsapp"
    if "instagram" in text or "insta" in text:
        return "instagram"
    return default_channel or "other"


def _action_value(actions, types) -> int:
    if not actions:
        return 0
    by_type = {a.get("action_type"): a.get("value") for a in actions}
    for t in types:
        if t in by_type:
            try:
                return int(float(by_type[t]))
            except (TypeError, ValueError):
                return 0
    return 0


def _serialize_spend(s: AdSpend) -> dict:
    return {
        "id": s.id,
        "account_act_id": s.account_act_id,
        "account_name": s.account_name,
        "purpose": s.purpose,
        "date": s.date.isoformat() if s.date else None,
        "campaign_name": s.campaign_name,
        "adset_name": s.adset_name,
        "channel": s.channel,
        "objective": s.objective,
        "spend": float(s.spend) if s.spend is not None else 0.0,
        "impressions": s.impressions or 0,
        "clicks": s.clicks or 0,
        "reach": s.reach or 0,
        "results": s.results or 0,
        "result_type": s.result_type,
        "currency": s.currency or "TRY",
        "source": s.source,
    }


def _serialize_registration(r: Registration) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "email": r.email,
        "phone": r.phone,
        "seminar": r.seminar,
        "registered_at": iso_utc(r.registered_at),
        "source": r.source,
        "matched_contact_id": r.matched_contact_id,
        "matched_contact": {
            "id": r.matched_contact.id,
            "name": r.matched_contact.full_name or r.matched_contact.name,
        } if r.matched_contact else None,
        "uploaded_at": iso_utc(r.uploaded_at),
    }


# ----------------------------- reklam hesapları (CRUD) -----------------------------

def _normalize_act_id(s):
    s = (s or "").strip()
    if s and not s.startswith("act_") and s.isdigit():
        s = "act_" + s
    return s


def _serialize_account(a: AdAccount) -> dict:
    return {"id": a.id, "act_id": a.act_id, "name": a.name,
            "purpose": a.purpose, "is_active": a.is_active}


@router.get("/ad-accounts")
def list_ad_accounts(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(AdAccount).order_by(AdAccount.is_active.desc(), AdAccount.id.asc()).all()
    return [_serialize_account(a) for a in rows]


@router.post("/ad-accounts")
def create_ad_account(body: dict = Body(...), current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    act_id = _normalize_act_id(body.get("act_id"))
    if not act_id:
        raise HTTPException(400, "Reklam hesabı ID'si zorunlu")
    name = (body.get("name") or "").strip() or act_id
    purpose = body.get("purpose") if body.get("purpose") in config.VALID_AD_PURPOSES else "genel"
    if db.query(AdAccount.id).filter(AdAccount.act_id == act_id).first():
        raise HTTPException(400, "Bu reklam hesabı zaten ekli")
    a = AdAccount(act_id=act_id, name=name, purpose=purpose,
                  is_active=bool(body.get("is_active", True)),
                  created_by_user_id=current_user.id)
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"status": "ok", "id": a.id}


@router.put("/ad-accounts/{account_id}")
def update_ad_account(account_id: int, body: dict = Body(...), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    a = db.query(AdAccount).filter(AdAccount.id == account_id).first()
    if not a:
        raise HTTPException(404, "Hesap bulunamadı")
    if "act_id" in body:
        new_act = _normalize_act_id(body.get("act_id"))
        if not new_act:
            raise HTTPException(400, "Geçersiz reklam hesabı ID'si")
        if new_act != a.act_id and db.query(AdAccount.id).filter(AdAccount.act_id == new_act).first():
            raise HTTPException(400, "Bu reklam hesabı zaten ekli")
        a.act_id = new_act
    if body.get("name"):
        a.name = body["name"].strip()
    if "purpose" in body and body["purpose"] in config.VALID_AD_PURPOSES:
        a.purpose = body["purpose"]
    if "is_active" in body:
        a.is_active = bool(body["is_active"])
    db.commit()
    return {"status": "ok"}


@router.delete("/ad-accounts/{account_id}")
def delete_ad_account(account_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    a = db.query(AdAccount).filter(AdAccount.id == account_id).first()
    if not a:
        return {"error": "Bulunamadı"}
    db.delete(a)
    db.commit()
    return {"status": "ok"}


def _db_accounts(db):
    rows = db.query(AdAccount).filter(AdAccount.is_active == True).all()
    return [{"act_id": a.act_id, "name": a.name, "purpose": a.purpose} for a in rows]


# ----------------------------- Meta senkronizasyonu -----------------------------

def _meta_get(client, url, params=None):
    resp = client.get(url, params=params, timeout=60.0)
    return resp.json()


def _discover_accounts(client, token, version):
    """Token altındaki reklam hesaplarını listeler (META_AD_ACCOUNTS boşsa)."""
    url = f"https://graph.facebook.com/{version}/me/adaccounts"
    params = {"fields": "account_id,name", "limit": 200, "access_token": token}
    out, page = [], 0
    while url and page < 20:
        data = _meta_get(client, url, params)
        params = None  # paging.next tam URL içerir
        if data.get("error"):
            return out, data["error"]
        for a in data.get("data", []):
            act_id = a.get("id") or (f"act_{a['account_id']}" if a.get("account_id") else None)
            if act_id:
                out.append({"act_id": act_id, "name": a.get("name") or act_id, "purpose": "genel"})
        url = (data.get("paging") or {}).get("next")
        page += 1
    return out, None


def _upsert_spend(db, rec, act_id, name, purpose, default_channel) -> int:
    row_date = _parse_date(rec.get("date_start"))
    if not row_date:
        return 0
    try:
        spend = Decimal(str(rec.get("spend") or "0"))
    except InvalidOperation:
        spend = Decimal("0")

    actions = rec.get("actions") or []
    messaging = _action_value(actions, MESSAGING_ACTION_TYPES)
    link_clicks = _action_value(actions, ["link_click"])
    if purpose in ("ig_dm", "wa_dm"):
        results, result_type = messaging, "messaging_conversation_started"
    elif purpose == "wix_kayit":
        results, result_type = link_clicks, "link_click"
    else:  # genel
        if messaging:
            results, result_type = messaging, "messaging_conversation_started"
        else:
            results, result_type = link_clicks, "link_click"

    adset_id = rec.get("adset_id")
    existing = (db.query(AdSpend)
                .filter(AdSpend.account_act_id == act_id,
                        AdSpend.date == row_date,
                        AdSpend.adset_id == adset_id)
                .first())
    target = existing or AdSpend(account_act_id=act_id, date=row_date, adset_id=adset_id)
    if existing is None:
        db.add(target)

    target.account_name = name
    target.purpose = purpose
    target.campaign_id = rec.get("campaign_id")
    target.campaign_name = rec.get("campaign_name")
    target.adset_name = rec.get("adset_name")
    target.channel = _classify_channel(default_channel, rec.get("adset_name"), rec.get("campaign_name"))
    target.objective = rec.get("objective")
    target.spend = spend
    target.impressions = int(float(rec.get("impressions") or 0))
    target.clicks = int(float(rec.get("clicks") or 0))
    target.reach = int(float(rec.get("reach") or 0))
    target.results = results
    target.result_type = result_type
    target.currency = rec.get("account_currency") or "TRY"
    target.source = "meta_sync"
    target.synced_at = datetime.utcnow()
    return 1


@router.post("/ads/sync")
def sync_ads(
    request: Request,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    token = config.META_ACCESS_TOKEN
    if not token:
        return {"status": "error", "synced": 0,
                "error": "META_ACCESS_TOKEN tanımlı değil. Reklam senkronizasyonu için "
                         "Meta erişim anahtarı (.env) gerekli."}

    version = config.META_GRAPH_VERSION
    to_d = _parse_date(to) or date.today()
    from_d = _parse_date(from_) or (to_d - timedelta(days=30))
    client = request.app.state.sync_http

    # Hesap kaynağı önceliği: DB (Parametreler ekranı) → .env → token'dan otomatik keşif
    accounts = _db_accounts(db)
    if not accounts:
        accounts = config.get_configured_ad_accounts()
    if not accounts:
        accounts, disc_err = _discover_accounts(client, token, version)
        if disc_err:
            msg = disc_err.get("message", str(disc_err)) if isinstance(disc_err, dict) else str(disc_err)
            return {"status": "error", "synced": 0, "error": f"Reklam hesapları alınamadı: {msg}"}
        if not accounts:
            return {"status": "error", "synced": 0,
                    "error": "Reklam hesabı tanımlı değil. Parametreler → Reklam Hesapları'ndan ekleyin."}

    upserted = 0
    errors = []
    for acc in accounts:
        act_id, name, purpose = acc["act_id"], acc["name"], acc["purpose"]
        default_channel = _default_channel_for_purpose(purpose)
        url = f"https://graph.facebook.com/{version}/{act_id}/insights"
        params = {
            "level": "adset",
            "time_increment": 1,
            "time_range": json.dumps({"since": from_d.isoformat(), "until": to_d.isoformat()}),
            "fields": ("campaign_id,campaign_name,adset_id,adset_name,objective,"
                       "spend,impressions,clicks,reach,actions,account_currency,date_start,date_stop"),
            "limit": 200,
            "access_token": token,
        }
        try:
            page = 0
            while url and page < 50:
                data = _meta_get(client, url, params)
                params = None
                if data.get("error"):
                    err = data["error"]
                    errors.append({"account": act_id, "error": err.get("message", str(err))})
                    break
                for rec in data.get("data", []):
                    upserted += _upsert_spend(db, rec, act_id, name, purpose, default_channel)
                url = (data.get("paging") or {}).get("next")
                page += 1
        except Exception as e:  # ağ/parse hatası bir hesabı düşürmesin
            errors.append({"account": act_id, "error": str(e)})

    db.commit()
    return {"status": "ok", "synced": upserted, "accounts": len(accounts), "errors": errors}


@router.post("/ads/manual")
def manual_spend(
    body: dict = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Token yokken ekranı test edebilmek için elle harcama girişi (UI'da gösterilmez)."""
    body = body or {}
    act_id = (body.get("account_act_id") or "").strip()
    if not act_id:
        raise HTTPException(400, "account_act_id zorunlu")
    if not act_id.startswith("act_") and act_id.isdigit():
        act_id = "act_" + act_id
    d = _parse_date(body.get("date"))
    if not d:
        raise HTTPException(400, "Geçersiz tarih (YYYY-MM-DD)")
    try:
        spend = Decimal(str(body.get("spend") or "0"))
    except InvalidOperation:
        raise HTTPException(400, "Geçersiz harcama")
    purpose = body.get("purpose") if body.get("purpose") in config.VALID_AD_PURPOSES else "genel"
    channel = body.get("channel") or _default_channel_for_purpose(purpose)
    label = body.get("campaign_name") or "genel"
    slug = "".join(c for c in str(label).lower() if c.isalnum())[:30] or "genel"
    adset_id = f"manual:{slug}"

    existing = (db.query(AdSpend)
                .filter(AdSpend.account_act_id == act_id, AdSpend.date == d, AdSpend.adset_id == adset_id)
                .first())
    target = existing or AdSpend(account_act_id=act_id, date=d, adset_id=adset_id)
    if existing is None:
        db.add(target)
    target.account_name = body.get("account_name") or act_id
    target.purpose = purpose
    target.campaign_name = body.get("campaign_name")
    target.adset_name = body.get("adset_name") or label
    target.channel = channel
    target.spend = spend
    target.results = int(body.get("results") or 0)
    target.result_type = "manual"
    target.currency = (body.get("currency") or "TRY")[:3].upper()
    target.source = "manual"
    target.synced_at = datetime.utcnow()
    db.commit()
    db.refresh(target)
    return {"status": "ok", "id": target.id}


# ----------------------------- Wix kayıtları (CSV) -----------------------------

@router.post("/registrations/upload")
async def upload_registrations(
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_CSV_SIZE:
        raise HTTPException(400, "Dosya 5MB'tan büyük olamaz")
    text = raw_bytes.decode("utf-8-sig", errors="replace")  # Excel BOM'u temizle

    first_line = text.split("\n", 1)[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise HTTPException(400, "CSV başlık satırı okunamadı")

    col_to_field = {}
    for col in reader.fieldnames:
        n = _norm_header(col)
        for field, variants in HEADER_MAP.items():
            if n in variants:
                col_to_field[col] = field
                break
    if "email" not in col_to_field.values() and "phone" not in col_to_field.values():
        raise HTTPException(400, "CSV'de e-posta veya telefon sütunu bulunamadı. Başlıkları kontrol edin.")

    inserted = skipped = matched = total_rows = 0
    seen_keys = set()
    for row in reader:
        total_rows += 1
        vals = {"name": None, "email": None, "phone": None, "seminar": None, "registered_at": None}
        for col, field in col_to_field.items():
            vals[field] = (row.get(col) or "").strip() or None
        email = _norm_email(vals["email"])
        phone = _norm_phone(vals["phone"])
        reg_dt = _parse_dt(vals["registered_at"])
        dedup = _dedup_key(email, phone, vals["seminar"], reg_dt)

        if dedup:
            if dedup in seen_keys:
                skipped += 1
                continue
            if db.query(Registration.id).filter(Registration.dedup_key == dedup).first():
                skipped += 1
                continue
            seen_keys.add(dedup)

        reg = Registration(
            name=vals["name"], email=email, phone=phone, seminar=vals["seminar"],
            registered_at=reg_dt, source="wix_csv", dedup_key=dedup,
            raw=json.dumps(row, ensure_ascii=False),
        )
        contact = None
        if email:
            contact = db.query(Contact).filter(func.lower(Contact.email) == email).first()
        if contact is None and phone and len(phone) >= 7:
            contact = db.query(Contact).filter(Contact.phone.like(f"%{phone[-10:]}%")).first()
        if contact is not None:
            reg.matched_contact_id = contact.id
            matched += 1
        db.add(reg)
        inserted += 1

    db.commit()
    return {"status": "ok", "inserted": inserted, "skipped": skipped,
            "matched": matched, "total_rows": total_rows}


@router.get("/registrations")
def list_registrations(
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    matched: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))
    reg_dt_col = func.coalesce(Registration.registered_at, Registration.uploaded_at)

    base = db.query(Registration)
    if q:
        like = f"%{q}%"
        base = base.filter(or_(Registration.name.ilike(like),
                               Registration.email.ilike(like),
                               Registration.phone.ilike(like)))
    df = _parse_dt(date_from)
    dt = _parse_dt(date_to)
    if df:
        base = base.filter(reg_dt_col >= df)
    if dt:
        base = base.filter(reg_dt_col <= dt)
    if matched is True:
        base = base.filter(Registration.matched_contact_id.isnot(None))
    elif matched is False:
        base = base.filter(Registration.matched_contact_id.is_(None))

    total = base.with_entities(func.count(Registration.id)).scalar() or 0
    matched_total = (base.with_entities(func.count(Registration.id))
                     .filter(Registration.matched_contact_id.isnot(None)).scalar()) or 0
    rows = (base.order_by(reg_dt_col.desc(), Registration.id.desc())
            .limit(limit).offset(offset).all())
    return {
        "total": int(total),
        "summary": {"total": int(total), "matched": int(matched_total),
                    "unmatched": int(total) - int(matched_total)},
        "items": [_serialize_registration(r) for r in rows],
    }


# ----------------------------- harcama listesi + özet -----------------------------

@router.get("/ad-spend")
def list_ad_spend(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    account: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))
    base = db.query(AdSpend)
    df = _parse_date(date_from)
    dt = _parse_date(date_to)
    if df:
        base = base.filter(AdSpend.date >= df)
    if dt:
        base = base.filter(AdSpend.date <= dt)
    if account:
        base = base.filter(AdSpend.account_act_id == account)
    if channel:
        base = base.filter(AdSpend.channel == channel)
    total = base.with_entities(func.count(AdSpend.id)).scalar() or 0
    rows = (base.order_by(AdSpend.date.desc(), AdSpend.id.desc())
            .limit(limit).offset(offset).all())
    return {"total": int(total), "items": [_serialize_spend(s) for s in rows]}


@router.delete("/ad-spend")
def clear_ad_spend(
    account: Optional[str] = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Saklı reklam harcaması satırlarını siler. account verilirse sadece o hesabı,
    verilmezse tümünü temizler. Hesap tanımlarını (AdAccount) ve kayıtları etkilemez."""
    q = db.query(AdSpend)
    if account:
        q = q.filter(AdSpend.account_act_id == account)
    deleted = q.delete(synchronize_session=False)
    db.commit()
    return {"status": "ok", "deleted": int(deleted or 0)}


@router.get("/analytics/summary")
def analytics_summary(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    account: Optional[str] = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    to_d = _parse_date(to) or date.today()
    from_d = _parse_date(from_) or (to_d - timedelta(days=30))
    spend_filters = [AdSpend.date >= from_d, AdSpend.date <= to_d]
    if account:
        spend_filters.append(AdSpend.account_act_id == account)
    spend_range = tuple(spend_filters)

    # --- hesap bazlı ---
    acc_rows = (db.query(
        AdSpend.account_act_id,
        func.max(AdSpend.account_name),
        func.max(AdSpend.purpose),
        func.max(AdSpend.currency),
        func.coalesce(func.sum(AdSpend.spend), 0),
        func.coalesce(func.sum(AdSpend.impressions), 0),
        func.coalesce(func.sum(AdSpend.clicks), 0),
        func.coalesce(func.sum(AdSpend.reach), 0),
        func.coalesce(func.sum(AdSpend.results), 0),
    ).filter(*spend_range).group_by(AdSpend.account_act_id).all())

    by_account = []
    wix_spend = 0.0
    for act_id, name, purpose, currency, spend, impr, clicks, reach, results in acc_rows:
        spend = float(spend or 0)
        results = int(results or 0)
        if purpose == "wix_kayit":
            wix_spend += spend
            primary = "spend"
        elif purpose in ("ig_dm", "wa_dm"):
            primary = "cost_per_conversation"
        else:
            primary = "spend"
        cpc_conv = (spend / results) if results else None
        by_account.append({
            "account_act_id": act_id,
            "name": name or act_id,
            "purpose": purpose or "genel",
            "currency": currency or "TRY",
            "spend": spend,
            "impressions": int(impr or 0),
            "clicks": int(clicks or 0),
            "reach": int(reach or 0),
            "results": results,
            "cost_per_conversation": cpc_conv,
            "primary_metric": primary,
        })

    # --- kanal bazlı ---
    ch_rows = (db.query(
        AdSpend.channel,
        func.coalesce(func.sum(AdSpend.spend), 0),
        func.coalesce(func.sum(AdSpend.clicks), 0),
        func.coalesce(func.sum(AdSpend.results), 0),
    ).filter(*spend_range).group_by(AdSpend.channel).all())
    by_channel = []
    for channel, spend, clicks, results in ch_rows:
        spend = float(spend or 0)
        results = int(results or 0)
        by_channel.append({
            "channel": channel or "other",
            "spend": spend,
            "clicks": int(clicks or 0),
            "conversations": results,
            "cost_per_conversation": (spend / results) if results else None,
        })

    # --- para birimi kırılımı ---
    cur_rows = (db.query(AdSpend.currency, func.coalesce(func.sum(AdSpend.spend), 0))
                .filter(*spend_range).group_by(AdSpend.currency).all())
    by_currency = [{"currency": c or "TRY", "spend": float(s or 0)} for c, s in cur_rows]
    multi_currency = len(by_currency) > 1

    total_spend = float(db.query(func.coalesce(func.sum(AdSpend.spend), 0)).filter(*spend_range).scalar() or 0)
    total_clicks = int(db.query(func.coalesce(func.sum(AdSpend.clicks), 0)).filter(*spend_range).scalar() or 0)
    total_conversations = int(db.query(func.coalesce(func.sum(AdSpend.results), 0))
                              .filter(*spend_range, AdSpend.result_type == "messaging_conversation_started")
                              .scalar() or 0)

    # --- kayıtlar (registered_at yoksa uploaded_at) ---
    reg_dt_col = func.coalesce(Registration.registered_at, Registration.uploaded_at)
    from_dt = datetime.combine(from_d, datetime.min.time())
    to_dt = datetime.combine(to_d, datetime.max.time())
    reg_base = db.query(Registration).filter(reg_dt_col >= from_dt, reg_dt_col <= to_dt)
    total_reg = reg_base.with_entities(func.count(Registration.id)).scalar() or 0
    matched_reg = (reg_base.with_entities(func.count(Registration.id))
                   .filter(Registration.matched_contact_id.isnot(None)).scalar()) or 0

    # --- CPA ---
    if wix_spend > 0:
        cpa = (wix_spend / total_reg) if total_reg else None
        cpa_note = ("CPA = Wix'e yönlendiren hesapların toplam harcaması / toplam kayıt "
                    "(Faz 1: kanal kırılımı yok).")
    else:
        cpa = (total_spend / total_reg) if total_reg else None
        cpa_note = ("Etiketli 'wix_kayit' hesabı yok; CPA = TÜM hesapların harcaması / toplam kayıt. "
                    "Daha doğru sonuç için META_AD_ACCOUNTS'ta hesabı 'wix_kayit' olarak işaretleyin.")

    return {
        "range": {"from": from_d.isoformat(), "to": to_d.isoformat()},
        "overall": {
            "spend": total_spend,
            "clicks": total_clicks,
            "conversations": total_conversations,
            "registrations": int(total_reg),
            "matched_registrations": int(matched_reg),
            "cpa": cpa,
            "cpa_note": cpa_note,
            "multi_currency": multi_currency,
            "by_currency": by_currency,
        },
        "by_channel": by_channel,
        "by_account": by_account,
    }
