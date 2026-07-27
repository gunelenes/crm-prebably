"""Sistem Sağlığı / Geliştirici Paneli — yalnızca owner (OWNER_USERNAME) erişebilir.

Dış entegrasyonların (Instagram/Meta token'ları, mail, API sürümü) sağlığını on-demand
kontrol eder ve geliştiriciye uygulanabilir görevler ("token'ını yenile" vb.) üretir.
Uygulama satıldığında alıcı admin bile bu paneli göremez (bkz. require_owner).
"""
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import Contact, AdSyncState, User
from app.auth import require_owner
from app.utils import iso_utc
from app import config

router = APIRouter()

# İsim yenileme uyarısı için eşik: son kullanma tarihine bu günden az kaldıysa "uyarı".
TOKEN_WARN_DAYS = 7


def _days_left(expires_at):
    if not expires_at:
        return None
    return (expires_at - datetime.utcnow()).days


def _check_instagram(client) -> dict:
    """Instagram mesajlaşma token'ı sağlığı: debug_token (geçerlilik + süre) + canlı
    /me çağrısı (kullanıcı adı çekme gerçekten çalışıyor mu?)."""
    token = config.INSTAGRAM_TOKEN
    version = config.INSTAGRAM_GRAPH_VERSION
    if not token:
        return {"key": "instagram_token", "label": "Instagram Token", "status": "error",
                "detail": "INSTAGRAM_TOKEN tanımlı değil.", "expires_at": None, "days_left": None,
                "graph_version": version}

    # 1) Süre/geçerlilik: advertising._check_token (debug_token, app-token ile)
    from app.api.advertising import _check_token
    tok = _check_token(client, token, config.META_GRAPH_VERSION)
    valid = tok.get("valid")
    expires_at = tok.get("expires_at")
    days_left = _days_left(expires_at)

    # 2) Canlı doğrulama: kullanıcı adı/görünen ad çekiminin gerçekten çalıştığını kanıtlar
    live_ok = False
    live_error = None
    try:
        url = (f"https://graph.instagram.com/{version}/me"
               f"?fields=id,username&access_token={token}")
        data = client.get(url, timeout=30.0).json()
        if data.get("error"):
            live_error = data["error"].get("message") or str(data["error"])
        else:
            live_ok = bool(data.get("id"))
    except Exception as e:
        live_error = str(e)

    if not live_ok or valid is False:
        status = "error"
        detail = live_error or "Token geçersiz görünüyor."
    elif days_left is not None and days_left < TOKEN_WARN_DAYS:
        status = "warning"
        detail = f"Token {days_left} gün içinde doluyor."
    else:
        status = "ok"
        detail = "Token geçerli, kullanıcı adı çekimi çalışıyor."

    return {"key": "instagram_token", "label": "Instagram Token", "status": status,
            "detail": detail, "expires_at": iso_utc(expires_at), "days_left": days_left,
            "graph_version": version, "live_ok": live_ok}


def _check_meta_ads(db) -> dict:
    """Meta reklam token'ı sağlığı — AdSyncState'ten (auto_sync_tick doldurur)."""
    configured = bool(config.META_ACCESS_TOKEN)
    st = db.query(AdSyncState).first()
    if not configured:
        return {"key": "meta_ads_token", "label": "Meta Reklam Token", "status": "warning",
                "detail": "META_ACCESS_TOKEN tanımlı değil (reklam analizi devre dışı).",
                "expires_at": None, "days_left": None}
    if not st or st.token_valid is None:
        return {"key": "meta_ads_token", "label": "Meta Reklam Token", "status": "unknown",
                "detail": "Henüz kontrol edilmedi (ilk otomatik senkron bekleniyor).",
                "expires_at": iso_utc(st.token_expires_at) if st else None,
                "days_left": _days_left(st.token_expires_at) if st else None}
    days_left = _days_left(st.token_expires_at)
    if st.token_valid is False:
        status, detail = "error", "Token geçersiz."
    elif days_left is not None and days_left < TOKEN_WARN_DAYS:
        status, detail = "warning", f"Token {days_left} gün içinde doluyor."
    else:
        status, detail = "ok", "Token geçerli."
    return {"key": "meta_ads_token", "label": "Meta Reklam Token", "status": status,
            "detail": detail, "expires_at": iso_utc(st.token_expires_at), "days_left": days_left}


def _check_mail(db) -> dict:
    """Mail gönderimi (Gmail OAuth / SMTP) yapılandırılmış mı?"""
    from app.api.mail_settings import get_effective_mail_settings
    eff = get_effective_mail_settings(db)
    if eff:
        return {"key": "mail", "label": "E-posta Gönderimi", "status": "ok",
                "detail": f"Yapılandırılmış (kaynak: {eff.get('source')}).", "expires_at": None,
                "days_left": None}
    return {"key": "mail", "label": "E-posta Gönderimi", "status": "warning",
            "detail": "Mail yapılandırılmamış (seminer e-postaları gönderilmez).",
            "expires_at": None, "days_left": None}


def _count_fallback_names(db) -> int:
    """Kullanıcı adı çekilemediği için yer tutucu isimde ('Instagram Kullanici ...' veya
    eski 'Instagram XXXXXX') kalmış, elle isimlendirilmemiş Instagram kişileri."""
    return db.query(func.count(Contact.id)).filter(
        Contact.platform == "instagram",
        Contact.full_name.is_(None),
        or_(
            Contact.name.like("Instagram Kullanici %"),
            Contact.name.like("Instagram ______"),
        ),
    ).scalar() or 0


@router.get("/system/health")
def system_health(request: Request, _: User = Depends(require_owner), db: Session = Depends(get_db)):
    client = request.app.state.sync_http

    ig = _check_instagram(client)
    meta = _check_meta_ads(db)
    mail = _check_mail(db)
    fallback_count = _count_fallback_names(db)

    checks = [
        ig,
        meta,
        mail,
        {"key": "instagram_api_version", "label": "Instagram API Sürümü", "status": "info",
         "detail": config.INSTAGRAM_GRAPH_VERSION, "expires_at": None, "days_left": None},
        {"key": "fallback_names",
         "label": "Kullanıcı Adı Olmayan Kişiler",
         "status": "warning" if fallback_count else "ok",
         "detail": f"{fallback_count} kişi yer tutucu isimde.",
         "count": fallback_count, "expires_at": None, "days_left": None},
    ]

    tasks = []

    if ig["status"] == "error":
        tasks.append({
            "severity": "critical",
            "title": "Instagram token'ı yenilenmeli",
            "action": (f"Kullanıcı adı çekimi çalışmıyor ({ig['detail']}). Meta'dan yeni bir "
                       "uzun ömürlü Instagram token'ı al ve Railway ortam değişkeni "
                       "INSTAGRAM_TOKEN'ı güncelle. Sürüm sorunu ise INSTAGRAM_GRAPH_VERSION'ı "
                       "güncel bir sürüme çek (ör. v21.0)."),
        })
    elif ig["status"] == "warning":
        tasks.append({
            "severity": "warning",
            "title": "Instagram token'ının süresi yakında doluyor",
            "action": f"{ig['detail']} Dolmadan önce Railway'de INSTAGRAM_TOKEN'ı yenile.",
        })

    if fallback_count:
        tasks.append({
            "severity": "warning" if ig["status"] != "error" else "info",
            "title": f"{fallback_count} kişi kullanıcı adı olmadan kayıtlı",
            "action": ("Instagram token'ı geçerli olduğunda 'Kullanıcı adlarını yenile' "
                       "butonuna basarak bu kişilerin isimlerini @handle ile güncelle."),
        })

    if meta["status"] == "error":
        tasks.append({"severity": "warning", "title": "Meta reklam token'ı geçersiz",
                      "action": "Railway'de META_ACCESS_TOKEN'ı yenile (reklam analizi için)."})
    elif meta["status"] == "warning" and config.META_ACCESS_TOKEN:
        tasks.append({"severity": "info", "title": "Meta reklam token'ı yakında doluyor",
                      "action": meta["detail"]})

    if mail["status"] == "warning":
        tasks.append({"severity": "info", "title": "E-posta gönderimi yapılandırılmamış",
                      "action": "Parametreler > Mail Ayarları'ndan Gmail/SMTP bağlantısını kur."})

    return {
        "generated_at": iso_utc(datetime.utcnow()),
        "checks": checks,
        "tasks": tasks,
    }


@router.post("/system/instagram/backfill-usernames")
def system_backfill_usernames(request: Request, background: BackgroundTasks,
                              _: User = Depends(require_owner)):
    """Backfill'i arka planda başlatır — Railway'in 300s edge timeout'una takılmasın
    diye request hemen döner. Sonuç konteyner logunda görünür."""
    from app.api.webhook import backfill_instagram_usernames
    client = request.app.state.sync_http

    def _run():
        with SessionLocal() as bg_db:
            try:
                result = backfill_instagram_usernames(client, bg_db)
                print(f"[backfill-usernames] tamamlandı: {result}")
            except Exception as e:
                print(f"[backfill-usernames] hata: {e}")

    background.add_task(_run)
    return {"status": "started",
            "message": "Backfill arka planda başlatıldı. Kişi sayısına göre birkaç dakika sürebilir. "
                       "Bittiğinde kişi listesini yenileyip kontrol edin."}
