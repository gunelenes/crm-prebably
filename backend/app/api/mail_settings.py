"""Mail Ayarları — Parametreler ekranından yönetilen SMTP kimlik bilgileri (admin-only).

Tek satır (id=1) `MailSettings` kullanılır. App Password şifreli saklanır ve API'den ASLA
düz olarak döndürülmez. DB'de ayar yoksa env (config.SMTP_*) yedeğe düşülür."""

from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MailSettings, User
from app.auth import require_admin
from app.services import crypto
from app.services.email import send_email
from app.utils import iso_utc
from app import config

router = APIRouter()


def _get_row(db: Session) -> MailSettings | None:
    return db.query(MailSettings).order_by(MailSettings.id.asc()).first()


def get_effective_mail_settings(db: Session) -> dict | None:
    """Gönderim için etkin SMTP ayarlarını döner: DB satırı (varsa) > env yedeği > None.

    Dönen sözlük: {host, port, use_ssl, user, password, from_name, source}."""
    row = _get_row(db)
    if row and row.smtp_user and row.password_enc:
        password = crypto.decrypt(row.password_enc)
        if password:
            return {
                "host": row.smtp_host or "smtp.gmail.com",
                "port": row.smtp_port or 465,
                "use_ssl": bool(row.use_ssl),
                "user": row.smtp_user,
                "password": password,
                "from_name": row.from_name or "",
                "source": "db",
            }
    # Env yedeği (geriye dönük uyum)
    if config.SMTP_USER and config.SMTP_PASSWORD:
        return {
            "host": config.SMTP_HOST or "smtp.gmail.com",
            "port": config.SMTP_PORT or 465,
            "use_ssl": config.SMTP_USE_SSL,
            "user": config.SMTP_USER,
            "password": config.SMTP_PASSWORD,
            "from_name": config.SMTP_FROM_NAME or "",
            "source": "env",
        }
    return None


@router.get("/mail-settings")
def get_mail_settings(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = _get_row(db)
    effective = get_effective_mail_settings(db)
    return {
        "smtp_host": (row.smtp_host if row else None) or "smtp.gmail.com",
        "smtp_port": (row.smtp_port if row else None) or 465,
        "use_ssl": bool(row.use_ssl) if row else True,
        "smtp_user": (row.smtp_user if row else None) or "",
        "from_name": (row.from_name if row else None) or "",
        "password_set": bool(row and row.password_enc),
        "configured": effective is not None,
        "source": effective["source"] if effective else "none",
    }


@router.put("/mail-settings")
def update_mail_settings(body: dict = Body(...), current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = _get_row(db)
    if not row:
        row = MailSettings()
        db.add(row)

    if "smtp_host" in body:
        row.smtp_host = (body.get("smtp_host") or "").strip() or "smtp.gmail.com"
    if "smtp_port" in body:
        try:
            row.smtp_port = int(body.get("smtp_port") or 465)
        except (ValueError, TypeError):
            row.smtp_port = 465
    if "use_ssl" in body:
        row.use_ssl = bool(body.get("use_ssl"))
    if "smtp_user" in body:
        row.smtp_user = (body.get("smtp_user") or "").strip().lower() or None
    if "from_name" in body:
        row.from_name = (body.get("from_name") or "").strip() or None

    # Parola: sadece dolu gelirse güncellenir; clear_password ile sıfırlanır.
    if body.get("clear_password"):
        row.password_enc = None
    else:
        new_pw = (body.get("password") or "").strip()
        if new_pw:
            row.password_enc = crypto.encrypt(new_pw)

    row.updated_by_user_id = current_user.id
    db.commit()
    return {"status": "ok"}


@router.post("/mail-settings/test")
def test_mail_settings(body: dict = Body(...), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    to = (body.get("to") or "").strip()
    if not to:
        return {"ok": False, "error": "Test için bir alıcı e-posta adresi gir."}
    settings = get_effective_mail_settings(db)
    if not settings:
        return {"ok": False, "error": "Mail ayarları eksik. Gönderen e-posta ve App Password gir, kaydet, sonra test et."}
    try:
        send_email(
            to,
            "CRM mail testi",
            "Bu bir **test** e-postasıdır. Mail ayarların doğru çalışıyor. 🎉",
            smtp=settings,
            from_name=settings.get("from_name") or None,
        )
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
