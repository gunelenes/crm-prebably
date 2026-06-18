"""Admin: Seminer formları CRUD + kayıt listesi + CSV export.

Tüm endpoint'ler kimlik doğrulama gerektirir. Public form okuma/submit
ayrı router'da (public_forms.py) ve auth'suz çalışır."""

from datetime import datetime
import csv
import io
import re

from fastapi import APIRouter, Depends, Body, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import SeminarForm, SeminarRegistration, User
from app.auth import get_current_user
from app.utils import iso_utc, slugify_tr, ensure_unique_slug


router = APIRouter()


ALLOWED_FIELD_TYPES = {"text", "email", "phone", "textarea", "select", "checkbox", "number", "date"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _normalize_field(raw: dict, idx: int) -> dict:
    """Bir alan tanımını doğrular ve normalize eder. Geçersiz olanı 400 fırlatır."""
    if not isinstance(raw, dict):
        raise HTTPException(400, f"Alan #{idx + 1} geçersiz")
    label = (raw.get("label") or "").strip()
    if not label:
        raise HTTPException(400, f"Alan #{idx + 1} için etiket zorunlu")
    ftype = (raw.get("type") or "text").strip().lower()
    if ftype not in ALLOWED_FIELD_TYPES:
        raise HTTPException(400, f"'{label}' alanı için tip geçersiz: {ftype}")
    key = (raw.get("key") or "").strip()
    if not key:
        key = slugify_tr(label).replace("-", "_")
    if not re.match(r"^[a-z0-9_]+$", key):
        raise HTTPException(400, f"'{label}' alanı için anahtar (key) geçersiz: {key}")
    field = {
        "key": key,
        "label": label,
        "type": ftype,
        "required": bool(raw.get("required", False)),
        "placeholder": (raw.get("placeholder") or "").strip() or None,
    }
    if ftype == "select":
        opts = raw.get("options") or []
        if not isinstance(opts, list) or not opts:
            raise HTTPException(400, f"'{label}' için en az bir seçenek gerekli")
        field["options"] = [str(o).strip() for o in opts if str(o).strip()]
        if not field["options"]:
            raise HTTPException(400, f"'{label}' için en az bir seçenek gerekli")
    return field


def _normalize_fields(fields_in) -> list[dict]:
    if not isinstance(fields_in, list) or not fields_in:
        raise HTTPException(400, "En az bir alan tanımlamalısınız")
    out: list[dict] = []
    seen_keys: set[str] = set()
    for i, f in enumerate(fields_in):
        nf = _normalize_field(f, i)
        if nf["key"] in seen_keys:
            raise HTTPException(400, f"Aynı anahtar (key) iki kez kullanılamaz: {nf['key']}")
        seen_keys.add(nf["key"])
        out.append(nf)
    return out


def _serialize_form(f: SeminarForm, registration_count: int | None = None) -> dict:
    return {
        "id": f.id,
        "title": f.title,
        "slug": f.slug,
        "description": f.description,
        "fields": f.fields or [],
        "thank_you_message": f.thank_you_message,
        "thank_you_redirect_url": f.thank_you_redirect_url,
        "is_active": f.is_active,
        "created_at": iso_utc(f.created_at),
        "created_by_user_id": f.created_by_user_id,
        "registration_count": registration_count,
    }


@router.get("/seminar-forms")
def list_seminar_forms(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    counts = dict(
        db.query(SeminarRegistration.form_id, func.count(SeminarRegistration.id))
        .group_by(SeminarRegistration.form_id)
        .all()
    )
    forms = db.query(SeminarForm).order_by(SeminarForm.id.desc()).all()
    return [_serialize_form(f, counts.get(f.id, 0)) for f in forms]


@router.get("/seminar-forms/{form_id}")
def get_seminar_form(form_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    f = db.query(SeminarForm).filter(SeminarForm.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form bulunamadı")
    count = db.query(func.count(SeminarRegistration.id)).filter(SeminarRegistration.form_id == f.id).scalar()
    return _serialize_form(f, count or 0)


@router.post("/seminar-forms")
def create_seminar_form(
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "Başlık zorunlu")
    fields = _normalize_fields(body.get("fields"))

    raw_slug = (body.get("slug") or "").strip().lower()
    base = raw_slug if (raw_slug and SLUG_RE.match(raw_slug)) else slugify_tr(title)
    slug = ensure_unique_slug(db, base, SeminarForm)

    redirect_url = (body.get("thank_you_redirect_url") or "").strip() or None
    if redirect_url and not re.match(r"^https?://", redirect_url):
        raise HTTPException(400, "Yönlendirme URL'i http:// veya https:// ile başlamalı")

    f = SeminarForm(
        title=title,
        slug=slug,
        description=(body.get("description") or "").strip() or None,
        fields=fields,
        thank_you_message=(body.get("thank_you_message") or "").strip() or None,
        thank_you_redirect_url=redirect_url,
        is_active=bool(body.get("is_active", True)),
        created_by_user_id=current_user.id,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return _serialize_form(f, 0)


@router.put("/seminar-forms/{form_id}")
def update_seminar_form(
    form_id: int,
    body: dict = Body(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    f = db.query(SeminarForm).filter(SeminarForm.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form bulunamadı")

    if "title" in body:
        title = (body.get("title") or "").strip()
        if not title:
            raise HTTPException(400, "Başlık boş olamaz")
        f.title = title

    if "slug" in body:
        raw_slug = (body.get("slug") or "").strip().lower()
        base = raw_slug if (raw_slug and SLUG_RE.match(raw_slug)) else slugify_tr(f.title)
        f.slug = ensure_unique_slug(db, base, SeminarForm, existing_id=f.id)

    if "description" in body:
        f.description = (body.get("description") or "").strip() or None

    if "fields" in body:
        f.fields = _normalize_fields(body.get("fields"))

    if "thank_you_message" in body:
        f.thank_you_message = (body.get("thank_you_message") or "").strip() or None

    if "thank_you_redirect_url" in body:
        url = (body.get("thank_you_redirect_url") or "").strip() or None
        if url and not re.match(r"^https?://", url):
            raise HTTPException(400, "Yönlendirme URL'i http:// veya https:// ile başlamalı")
        f.thank_you_redirect_url = url

    if "is_active" in body:
        f.is_active = bool(body.get("is_active"))

    db.commit()
    db.refresh(f)
    count = db.query(func.count(SeminarRegistration.id)).filter(SeminarRegistration.form_id == f.id).scalar()
    return _serialize_form(f, count or 0)


@router.delete("/seminar-forms/{form_id}")
def delete_seminar_form(form_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    f = db.query(SeminarForm).filter(SeminarForm.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form bulunamadı")
    db.delete(f)
    db.commit()
    return {"status": "ok"}


def _format_answer_value(field: dict, raw):
    """Bir alan cevabını insanca okunabilir bir string'e dönüştürür (tablo/CSV için)."""
    if raw is None:
        return ""
    if field["type"] == "phone" and isinstance(raw, dict):
        code = (raw.get("code") or "").strip()
        num = (raw.get("number") or "").strip()
        if not (code or num):
            return ""
        return f"{code} {num}".strip()
    if field["type"] == "checkbox":
        return "Evet" if raw else "Hayır"
    if isinstance(raw, (list, tuple)):
        return ", ".join(str(x) for x in raw)
    return str(raw)


def _parse_date(value: str | None, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        try:
            dt = datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            return None
    if end_of_day and dt.hour == 0 and dt.minute == 0 and dt.second == 0:
        dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    return dt


@router.get("/seminar-forms/{form_id}/registrations")
def list_registrations(
    form_id: int,
    q: str | None = Query(None, description="cevap içeriklerinde basit metin araması"),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    f = db.query(SeminarForm).filter(SeminarForm.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form bulunamadı")
    query = db.query(SeminarRegistration).filter(SeminarRegistration.form_id == form_id)
    dt_from = _parse_date(from_, end_of_day=False)
    if dt_from:
        query = query.filter(SeminarRegistration.created_at >= dt_from)
    dt_to = _parse_date(to, end_of_day=True)
    if dt_to:
        query = query.filter(SeminarRegistration.created_at <= dt_to)
    regs = query.order_by(SeminarRegistration.created_at.desc()).all()

    fields = f.fields or []
    items = []
    needle = (q or "").strip().lower()
    for r in regs:
        row = {field["key"]: _format_answer_value(field, (r.answers or {}).get(field["key"])) for field in fields}
        if needle and not any(needle in v.lower() for v in row.values() if v):
            continue
        items.append({
            "id": r.id,
            "created_at": iso_utc(r.created_at),
            "values": row,
        })
    return {
        "form": _serialize_form(f, registration_count=len(regs)),
        "items": items,
    }


@router.get("/seminar-forms/{form_id}/registrations/export")
def export_registrations_csv(
    form_id: int,
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    f = db.query(SeminarForm).filter(SeminarForm.id == form_id).first()
    if not f:
        raise HTTPException(404, "Form bulunamadı")
    query = db.query(SeminarRegistration).filter(SeminarRegistration.form_id == form_id)
    dt_from = _parse_date(from_, end_of_day=False)
    if dt_from:
        query = query.filter(SeminarRegistration.created_at >= dt_from)
    dt_to = _parse_date(to, end_of_day=True)
    if dt_to:
        query = query.filter(SeminarRegistration.created_at <= dt_to)
    regs = query.order_by(SeminarRegistration.created_at.asc()).all()

    fields = f.fields or []
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    headers = [field["label"] for field in fields] + ["Kayıt Tarihi"]
    writer.writerow(headers)
    for r in regs:
        row = [_format_answer_value(field, (r.answers or {}).get(field["key"])) for field in fields]
        row.append(r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "")
        writer.writerow(row)

    csv_bytes = ("﻿" + buf.getvalue()).encode("utf-8")
    safe_slug = re.sub(r"[^A-Za-z0-9_-]+", "-", f.slug) or "form"
    filename = f"{safe_slug}-kayitlar.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
