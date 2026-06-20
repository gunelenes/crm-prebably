"""Public seminer form sayfaları için endpoint'ler.

KESİNLİKLE AUTH YOK — herkes açabilir, herkes submit edebilir. Spam'ı
azaltmak için IP başına dakikada 3 kayıt limiti uygulanır."""

from collections import defaultdict, deque
from datetime import datetime, timedelta
import re
import threading

from fastapi import APIRouter, Body, HTTPException, Request, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import SeminarForm, SeminarRegistration, Company
from app.services.email import send_email, render_template
from app.api.mail_settings import get_effective_mail_settings
from app.utils import iso_utc


router = APIRouter()


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_CODE_RE = re.compile(r"^\+?[0-9]{1,5}$")
PHONE_NUM_RE = re.compile(r"^[0-9 \-]{6,20}$")

# Basit in-memory rate limit: aynı IP'den 60 saniye içinde en fazla 3 başarılı submit.
_RATE_LIMIT_WINDOW = timedelta(seconds=60)
_RATE_LIMIT_MAX = 3
_ip_history: dict[str, deque] = defaultdict(deque)
_ip_lock = threading.Lock()


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(ip: str) -> None:
    now = datetime.utcnow()
    cutoff = now - _RATE_LIMIT_WINDOW
    with _ip_lock:
        dq = _ip_history[ip]
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= _RATE_LIMIT_MAX:
            raise HTTPException(429, "Çok hızlı kayıt deniyorsun. Lütfen bir dakika sonra tekrar dene.")
        dq.append(now)


def _public_form_payload(f: SeminarForm) -> dict:
    """Public görünüm: id, created_by gibi iç bilgileri sızdırma."""
    return {
        "title": f.title,
        "slug": f.slug,
        "description": f.description,
        "fields": f.fields or [],
        "thank_you_message": f.thank_you_message,
        "thank_you_redirect_url": f.thank_you_redirect_url,
        "whatsapp_url": f.whatsapp_url,
        "website_url": f.website_url,
        "whatsapp_number": f.whatsapp_number,
        "whatsapp_template": f.whatsapp_template,
    }


@router.get("/public/forms/{slug}")
def get_public_form(slug: str, db: Session = Depends(get_db)):
    f = db.query(SeminarForm).filter(SeminarForm.slug == slug, SeminarForm.is_active == True).first()
    if not f:
        raise HTTPException(404, "Form bulunamadı veya aktif değil")
    return _public_form_payload(f)


def _validate_answer(field: dict, value):
    """Tek alan için cevabı doğrular, normalize edilmiş halini döner.
    HTTPException(400) ile reddedebilir."""
    ftype = field["type"]
    required = field.get("required", False)
    label = field["label"]

    if ftype == "checkbox":
        return bool(value)

    if ftype == "phone":
        if value is None or value == "":
            if required:
                raise HTTPException(400, f"'{label}' zorunlu")
            return None
        if not isinstance(value, dict):
            raise HTTPException(400, f"'{label}' için telefon biçimi geçersiz")
        code = (value.get("code") or "").strip()
        num = (value.get("number") or "").strip()
        if not code and not num:
            if required:
                raise HTTPException(400, f"'{label}' zorunlu")
            return None
        if code and not PHONE_CODE_RE.match(code):
            raise HTTPException(400, f"'{label}' ülke kodu geçersiz")
        if not PHONE_NUM_RE.match(num):
            raise HTTPException(400, f"'{label}' telefon numarası geçersiz")
        return {"code": code or "+90", "number": num}

    if value is None:
        if required:
            raise HTTPException(400, f"'{label}' zorunlu")
        return None

    text = str(value).strip()
    if not text:
        if required:
            raise HTTPException(400, f"'{label}' zorunlu")
        return None
    if len(text) > 2000:
        raise HTTPException(400, f"'{label}' çok uzun")

    if ftype == "email":
        if not EMAIL_RE.match(text):
            raise HTTPException(400, f"'{label}' geçerli bir e-posta değil")
        return text.lower()

    if ftype == "number":
        try:
            return float(text) if "." in text else int(text)
        except ValueError:
            raise HTTPException(400, f"'{label}' sayı olmalı")

    if ftype == "date":
        try:
            datetime.strptime(text, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, f"'{label}' tarih biçimi geçersiz (YYYY-AA-GG)")
        return text

    if ftype == "select":
        opts = field.get("options") or []
        if text not in opts:
            raise HTTPException(400, f"'{label}' için geçersiz seçim")
        return text

    # text | textarea
    return text


def _find_recipient_email(form: SeminarForm, normalized: dict) -> str | None:
    """Formdaki ilk 'email' tipi alanın doğrulanmış (lowercase) değerini döner."""
    for field in (form.fields or []):
        if field.get("type") == "email":
            val = normalized.get(field["key"])
            if val and isinstance(val, str):
                return val
    return None


def _send_registration_email(form_id, company_id, subject_tpl, body_tpl, to_email, answers):
    """BackgroundTask hedefi: kayıt sonrası otomatik e-posta. Kendi DB session'ını açar.
    Hata yukarı SIZMAMALI — sadece loglanır (kayıt zaten commit edildi)."""
    db2 = SessionLocal()
    try:
        settings = get_effective_mail_settings(db2)
        if not settings:
            return  # mail ayarları yok → no-op
        reply_to = None
        from_name = None
        logo_url = None
        if company_id:
            c = db2.query(Company).filter(Company.id == company_id, Company.is_active == True).first()
            if c:
                reply_to = c.email
                from_name = c.name
                logo_url = c.logo_url
        send_email(
            to_email,
            render_template(subject_tpl or "", answers),
            render_template(body_tpl or "", answers),
            settings=settings,
            reply_to=reply_to,
            from_name=from_name,
            logo_url=logo_url,
        )
    except Exception as e:
        print(f"Seminer kayıt e-posta gönderim hatası (form {form_id}):", e)
    finally:
        db2.close()


@router.post("/public/forms/{slug}/register")
def register_public_form(slug: str, request: Request, background: BackgroundTasks, body: dict = Body(...), db: Session = Depends(get_db)):
    f = db.query(SeminarForm).filter(SeminarForm.slug == slug, SeminarForm.is_active == True).first()
    if not f:
        raise HTTPException(404, "Form bulunamadı veya aktif değil")

    ip = _client_ip(request)
    _check_rate_limit(ip)

    incoming = body.get("answers") if isinstance(body.get("answers"), dict) else body
    if not isinstance(incoming, dict):
        raise HTTPException(400, "Geçersiz veri")

    normalized: dict = {}
    for field in (f.fields or []):
        key = field["key"]
        normalized[key] = _validate_answer(field, incoming.get(key))

    user_agent = (request.headers.get("user-agent") or "")[:500]
    reg = SeminarRegistration(
        form_id=f.id,
        answers=normalized,
        ip_address=ip[:64],
        user_agent=user_agent,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    # Otomatik e-posta: form açıksa, mail ayarları varsa ve alıcı e-postası bulunabiliyorsa,
    # yanıttan sonra arka planda gönder. Aksi halde sessiz no-op.
    if getattr(f, "email_autosend", False):
        to_email = _find_recipient_email(f, normalized)
        if to_email and get_effective_mail_settings(db):
            background.add_task(
                _send_registration_email,
                f.id, f.company_id, f.email_subject, f.email_body, to_email, normalized,
            )

    return {
        "status": "ok",
        "id": reg.id,
        "created_at": iso_utc(reg.created_at),
        "thank_you_message": f.thank_you_message,
        "thank_you_redirect_url": f.thank_you_redirect_url,
        "whatsapp_url": f.whatsapp_url,
        "website_url": f.website_url,
        "whatsapp_number": f.whatsapp_number,
        "whatsapp_template": f.whatsapp_template,
    }
