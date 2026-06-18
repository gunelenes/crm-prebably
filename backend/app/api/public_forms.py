"""Public seminer form sayfaları için endpoint'ler.

KESİNLİKLE AUTH YOK — herkes açabilir, herkes submit edebilir. Spam'ı
azaltmak için IP başına dakikada 3 kayıt limiti uygulanır."""

from collections import defaultdict, deque
from datetime import datetime, timedelta
import re
import threading

from fastapi import APIRouter, Body, HTTPException, Request, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SeminarForm, SeminarRegistration
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


@router.post("/public/forms/{slug}/register")
def register_public_form(slug: str, request: Request, body: dict = Body(...), db: Session = Depends(get_db)):
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
    return {
        "status": "ok",
        "id": reg.id,
        "created_at": iso_utc(reg.created_at),
        "thank_you_message": f.thank_you_message,
        "thank_you_redirect_url": f.thank_you_redirect_url,
    }
