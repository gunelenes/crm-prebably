from dotenv import load_dotenv
import os

load_dotenv()

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID")
INSTAGRAM_TOKEN = os.getenv("INSTAGRAM_TOKEN")
WEBHOOK_VERIFY_TOKEN = os.getenv("WEBHOOK_VERIFY_TOKEN")
# Meta'nın giden ses dosyalarını çekebilmesi için herkese açık (public) HTTPS taban adresi.
# Sonunda /api OLMADAN verilmeli — örn. https://crm-prebably-production.up.railway.app
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://crm-prebably-production.up.railway.app")
# DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/crm_db")

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7

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