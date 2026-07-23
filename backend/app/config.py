from dotenv import load_dotenv
import os

load_dotenv()

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID")
INSTAGRAM_TOKEN = os.getenv("INSTAGRAM_TOKEN")
INSTAGRAM_APP_ID = os.getenv("INSTAGRAM_APP_ID")
INSTAGRAM_APP_SECRET = os.getenv("INSTAGRAM_APP_SECRET")
# Instagram Graph API sürümü. Meta eski sürümleri kullanımdan kaldırdığında burayı
# (deploy'suz, env ile) güncelleyebilmek için sabit kod yerine env'den okunur.
INSTAGRAM_GRAPH_VERSION = os.getenv("INSTAGRAM_GRAPH_VERSION", "v21.0")
WEBHOOK_VERIFY_TOKEN = os.getenv("WEBHOOK_VERIFY_TOKEN")
# Kendi Instagram/Sayfa hesabımızın ID'si (giden/gelen ayrımı + sync katılımcı filtresi).
INSTAGRAM_PAGE_ID = os.getenv("INSTAGRAM_PAGE_ID", "17841401244343060")
# sync-conversations: bu tarihten (YYYY-MM-DD) önceki mesajlar atlanır.
SYNC_CUTOFF_DATE = os.getenv("SYNC_CUTOFF_DATE", "2026-05-15")
# CORS: virgülle ayrık izinli origin listesi; boşsa "*" (geriye dönük uyum).
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")
# Meta'nın giden ses dosyalarını çekebilmesi için herkese açık (public) HTTPS taban adresi.
# Sonunda /api OLMADAN verilmeli — örn. https://crm-prebably-production.up.railway.app
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://crm-prebably-production.up.railway.app")
# DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/crm_db")

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7

# Geliştirici/sahibi paneli erişimi: yalnızca bu kullanıcı adına sahip hesap
# "owner" sayılır (admin bile değil). Uygulama satıldığında alıcı bu env'i bilmediği
# için Sistem Sağlığı paneline erişemez. Boşsa hiç kimse owner değildir.
OWNER_USERNAME = os.getenv("OWNER_USERNAME", "")

# --- Meta reklam analizi (Marketing/Insights API) ---
# ads_read izinli system-user / business token. Aynı token business altındaki tüm
# reklam hesaplarının Insights verisini okuyabilir.
META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN")
META_GRAPH_VERSION = os.getenv("META_GRAPH_VERSION", "v21.0")
# İzlenecek reklam hesapları. Format (virgülle ayrık, her biri "act_id|isim|amaç"):
#   META_AD_ACCOUNTS=act_123|Wix Kayıt|wix_kayit, act_456|WhatsApp & IG DM|wa_dm
# Amaç değerleri: wix_kayit | ig_dm | wa_dm | genel
# Boş bırakılırsa hesaplar token'dan otomatik keşfedilir (me/adaccounts), amaç=genel.
META_AD_ACCOUNTS = os.getenv("META_AD_ACCOUNTS", "")

VALID_AD_PURPOSES = {"wix_kayit", "ig_dm", "wa_dm", "genel"}

# --- Otomatik seminer e-postası (Gmail SMTP, tek hesap + App Password) ---
# SMTP_PASSWORD = Gmail 16 haneli "Uygulama Şifresi" (2 Adımlı Doğrulama açık olmalı).
# Boş bırakılırsa gönderim yapılmaz (no-op); kayıt yine de oluşur.
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "")
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "true").lower() in ("1", "true", "yes")


def get_configured_ad_accounts():
    """META_AD_ACCOUNTS env'ini [{act_id, name, purpose}, ...] listesine ayrıştırır.
    Geçersiz/eksik satırlar atlanır. Boşsa boş liste döner (otomatik keşif devreye girer)."""
    accounts = []
    for chunk in (META_AD_ACCOUNTS or "").split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = [p.strip() for p in chunk.split("|")]
        act_id = parts[0] if parts else ""
        if not act_id:
            continue
        if not act_id.startswith("act_") and act_id.isdigit():
            act_id = "act_" + act_id
        name = parts[1] if len(parts) > 1 and parts[1] else act_id
        purpose = parts[2] if len(parts) > 2 and parts[2] in VALID_AD_PURPOSES else "genel"
        accounts.append({"act_id": act_id, "name": name, "purpose": purpose})
    return accounts