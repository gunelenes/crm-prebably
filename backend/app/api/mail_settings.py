"""Mail Ayarları — Parametreler ekranından yönetilen e-posta gönderim ayarları (admin-only).

Tek satır (id=1) `MailSettings`. Gönderim yöntemleri (provider):
- "gmail_oauth": "Google ile Bağlan" (OAuth refresh token) ile Gmail API. ADMIN GEREKTİRMEZ — önerilen.
- "gmail_api": servis hesabı + domain-wide delegation ile Gmail API (Workspace admin gerekir).
- "smtp": klasik SMTP (Railway dışa SMTP'yi engellediği için pratikte lokal/uygun ağlar için).

Sırlar (App Password, servis hesabı JSON, OAuth client secret, refresh token) şifreli saklanır ve
API'den ASLA düz döndürülmez. DB'de ayar yoksa env (config.SMTP_*) yedeğe düşülür."""

import json
import time
from urllib.parse import urlencode

import jwt
from fastapi import APIRouter, Depends, Body, Query
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MailSettings, User
from app.auth import require_admin
from app.services import crypto
from app.services.email import send_email
from app import config

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send"


def _get_row(db: Session) -> MailSettings | None:
    return db.query(MailSettings).order_by(MailSettings.id.asc()).first()


def _redirect_uri() -> str:
    return config.PUBLIC_BASE_URL.rstrip("/") + "/api/mail-settings/google/callback"


def _with_param(url: str, key: str, val: str) -> str:
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}{key}={val}"


def get_effective_mail_settings(db: Session) -> dict | None:
    """Gönderim için etkin ayarları döner: DB satırı (provider'a göre) > env smtp yedeği > None."""
    row = _get_row(db)
    if row:
        provider = row.provider or "gmail_oauth"
        if provider == "gmail_oauth" and row.google_client_id and row.google_client_secret_enc \
                and row.google_refresh_token_enc and row.smtp_user:
            secret = crypto.decrypt(row.google_client_secret_enc)
            refresh = crypto.decrypt(row.google_refresh_token_enc)
            if secret and refresh:
                return {
                    "provider": "gmail_oauth",
                    "client_id": row.google_client_id,
                    "client_secret": secret,
                    "refresh_token": refresh,
                    "sender": row.smtp_user,
                    "from_name": row.from_name or "",
                    "source": "db",
                }
        if provider == "gmail_api" and row.google_sa_json_enc and row.smtp_user:
            raw = crypto.decrypt(row.google_sa_json_enc)
            try:
                sa = json.loads(raw) if raw else None
            except (ValueError, TypeError):
                sa = None
            if sa and sa.get("client_email") and sa.get("private_key"):
                return {
                    "provider": "gmail_api",
                    "sa_json": sa,
                    "sender": row.smtp_user,
                    "from_name": row.from_name or "",
                    "source": "db",
                }
        if provider == "smtp" and row.smtp_user and row.password_enc:
            password = crypto.decrypt(row.password_enc)
            if password:
                return {
                    "provider": "smtp",
                    "host": row.smtp_host or "smtp.gmail.com",
                    "port": row.smtp_port or 465,
                    "use_ssl": bool(row.use_ssl),
                    "user": row.smtp_user,
                    "password": password,
                    "from_name": row.from_name or "",
                    "source": "db",
                }
    # Env yedeği (geriye dönük uyum — smtp)
    if config.SMTP_USER and config.SMTP_PASSWORD:
        return {
            "provider": "smtp",
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
        "provider": (row.provider if row else None) or "gmail_oauth",
        "smtp_user": (row.smtp_user if row else None) or "",
        "from_name": (row.from_name if row else None) or "",
        "smtp_host": (row.smtp_host if row else None) or "smtp.gmail.com",
        "smtp_port": (row.smtp_port if row else None) or 465,
        "use_ssl": bool(row.use_ssl) if row else True,
        "password_set": bool(row and row.password_enc),
        "gmail_connected": bool(row and row.google_sa_json_enc),
        "google_client_id": (row.google_client_id if row else None) or "",
        "google_secret_set": bool(row and row.google_client_secret_enc),
        "google_connected": bool(row and row.google_refresh_token_enc),
        "redirect_uri": _redirect_uri(),
        "configured": effective is not None,
        "source": effective["source"] if effective else "none",
    }


@router.put("/mail-settings")
def update_mail_settings(body: dict = Body(...), current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = _get_row(db)
    if not row:
        row = MailSettings()
        db.add(row)

    if "provider" in body:
        p = body.get("provider")
        row.provider = p if p in ("gmail_oauth", "gmail_api", "smtp") else "gmail_oauth"
    if "smtp_user" in body:
        row.smtp_user = (body.get("smtp_user") or "").strip().lower() or None
    if "from_name" in body:
        row.from_name = (body.get("from_name") or "").strip() or None
    if "smtp_host" in body:
        row.smtp_host = (body.get("smtp_host") or "").strip() or "smtp.gmail.com"
    if "smtp_port" in body:
        try:
            row.smtp_port = int(body.get("smtp_port") or 465)
        except (ValueError, TypeError):
            row.smtp_port = 465
    if "use_ssl" in body:
        row.use_ssl = bool(body.get("use_ssl"))

    # OAuth client kimliği (gmail_oauth)
    if "google_client_id" in body:
        row.google_client_id = (body.get("google_client_id") or "").strip() or None
    if body.get("google_client_secret"):
        row.google_client_secret_enc = crypto.encrypt(body["google_client_secret"].strip())

    # Servis hesabı JSON (gmail_api): sadece dolu gelirse doğrula + şifrele.
    if "google_sa_json" in body:
        raw = (body.get("google_sa_json") or "").strip()
        if raw:
            try:
                sa = json.loads(raw)
            except (ValueError, TypeError):
                return {"error": "Servis hesabı JSON'u geçersiz (çözümlenemedi)."}
            if not (sa.get("client_email") and sa.get("private_key")):
                return {"error": "JSON'da client_email ve private_key bulunamadı."}
            row.google_sa_json_enc = crypto.encrypt(raw)

    # App Password (smtp): sadece dolu gelirse güncellenir; clear_password ile sıfırlanır.
    if body.get("clear_password"):
        row.password_enc = None
    else:
        new_pw = (body.get("password") or "").strip()
        if new_pw:
            row.password_enc = crypto.encrypt(new_pw)

    row.updated_by_user_id = current_user.id
    db.commit()
    return {"status": "ok"}


@router.get("/mail-settings/google/auth")
def google_oauth_start(return_to: str = Query(""), current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """'Google ile Bağlan': Google izin sayfasının URL'ini üretir (SPA buraya yönlendirir)."""
    row = _get_row(db)
    if not (row and row.google_client_id):
        return {"error": "Önce Client ID ve Client Secret girip kaydet, sonra bağlan."}
    state = jwt.encode(
        {"purpose": "google_oauth", "uid": current_user.id, "return_to": return_to,
         "exp": int(time.time()) + 600},
        config.JWT_SECRET, algorithm=config.JWT_ALGORITHM,
    )
    params = {
        "client_id": row.google_client_id,
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": GMAIL_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    if row.smtp_user:
        params["login_hint"] = row.smtp_user
    return {"url": GOOGLE_AUTH_URL + "?" + urlencode(params)}


@router.get("/mail-settings/google/callback")
def google_oauth_callback(code: str = Query(""), state: str = Query(""), error: str = Query(""), db: Session = Depends(get_db)):
    """Google'dan dönen callback: refresh token'ı alıp şifreli saklar, kullanıcıyı geri yönlendirir.
    Auth, tarayıcı yönlendirmesi olduğu için Bearer ile değil imzalı `state` ile doğrulanır."""
    try:
        data = jwt.decode(state, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        if data.get("purpose") != "google_oauth":
            raise ValueError("bad purpose")
    except Exception:
        return HTMLResponse("<h3>Geçersiz veya süresi dolmuş bağlanma isteği. Lütfen tekrar dene.</h3>", status_code=400)

    return_to = data.get("return_to") or config.PUBLIC_BASE_URL
    if error or not code:
        return RedirectResponse(_with_param(return_to, "mail", "error"))

    row = _get_row(db)
    if not (row and row.google_client_id and row.google_client_secret_enc):
        return RedirectResponse(_with_param(return_to, "mail", "error"))

    client_secret = crypto.decrypt(row.google_client_secret_enc)
    try:
        import httpx
        with httpx.Client(timeout=20) as client:
            r = client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": row.google_client_id,
                "client_secret": client_secret,
                "redirect_uri": _redirect_uri(),
                "grant_type": "authorization_code",
            })
        tok = r.json() if r.content else {}
        refresh = tok.get("refresh_token")
        if r.status_code != 200 or not refresh:
            return RedirectResponse(_with_param(return_to, "mail", "error"))
        row.google_refresh_token_enc = crypto.encrypt(refresh)
        db.commit()
    except Exception:
        return RedirectResponse(_with_param(return_to, "mail", "error"))

    return RedirectResponse(_with_param(return_to, "mail", "connected"))


@router.post("/mail-settings/test")
def test_mail_settings(body: dict = Body(...), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    to = (body.get("to") or "").strip()
    if not to:
        return {"ok": False, "error": "Test için bir alıcı e-posta adresi gir."}
    settings = get_effective_mail_settings(db)
    if not settings:
        return {"ok": False, "error": "Mail ayarları eksik/bağlı değil. Gönderen e-postayı gir ve 'Google ile Bağlan' ile yetkilendir, sonra test et."}
    try:
        send_email(
            to,
            "CRM mail testi",
            "Bu bir **test** e-postasıdır. Mail ayarların doğru çalışıyor. 🎉",
            settings=settings,
            from_name=settings.get("from_name") or None,
        )
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
