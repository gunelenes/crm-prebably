import asyncio
from contextlib import asynccontextmanager
import httpx
import socketio
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from app.database import engine
from app.models import Base
from app.api import webhook, messages, quick_replies, statuses, contacts, auth as auth_api, users as users_api, sectors as sectors_api, training_sets as training_sets_api, bank_accounts as bank_accounts_api, payments as payments_api, dashboard as dashboard_api, advertising as advertising_api, issues as issues_api, seminar_forms as seminar_forms_api, public_forms as public_forms_api, companies as companies_api, mail_settings as mail_settings_api

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
http_client: httpx.AsyncClient | None = None
sync_http_client: httpx.Client | None = None


@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token") if isinstance(auth, dict) else None
    if not token:
        return False
    try:
        from app.auth import decode_token
        decode_token(token)
        return True
    except Exception:
        return False


# Otomatik reklam senkronizasyonu: arka plan döngüsü her bu kadar sürede bir
# kontrol eder; gerçek senkron sıklığı advertising.AUTO_SYNC_INTERVAL_HOURS'a bağlı.
AUTO_SYNC_CHECK_SECONDS = 1800  # 30 dk


async def _auto_sync_loop():
    from app.api.advertising import auto_sync_tick
    await asyncio.sleep(60)  # boot'u bloklamasın, ilk tetik 1 dk sonra
    while True:
        try:
            await asyncio.to_thread(auto_sync_tick)  # senkron iş → ayrı thread
        except asyncio.CancelledError:
            raise
        except Exception:
            pass
        await asyncio.sleep(AUTO_SYNC_CHECK_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client, sync_http_client
    Base.metadata.create_all(bind=engine)
    # Hafif şema evrimi: create_all mevcut tabloları ALTER/index etmez. Idempotent (IF NOT EXISTS).
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "ALTER TABLE contact_links ADD COLUMN IF NOT EXISTS primary_contact_id INTEGER"
            )
            # Seminer formu otomatik e-posta alanları (companies tablosu create_all ile oluşur).
            conn.exec_driver_sql("ALTER TABLE seminar_forms ADD COLUMN IF NOT EXISTS company_id INTEGER")
            conn.exec_driver_sql("ALTER TABLE seminar_forms ADD COLUMN IF NOT EXISTS email_subject TEXT")
            conn.exec_driver_sql("ALTER TABLE seminar_forms ADD COLUMN IF NOT EXISTS email_body TEXT")
            conn.exec_driver_sql("ALTER TABLE seminar_forms ADD COLUMN IF NOT EXISTS email_autosend BOOLEAN DEFAULT FALSE")
            conn.exec_driver_sql("ALTER TABLE seminar_forms ADD COLUMN IF NOT EXISTS whatsapp_url VARCHAR(500)")
            conn.exec_driver_sql("ALTER TABLE seminar_forms ADD COLUMN IF NOT EXISTS website_url VARCHAR(500)")
            conn.exec_driver_sql("ALTER TABLE seminar_forms ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(32)")
            conn.exec_driver_sql("ALTER TABLE seminar_forms ADD COLUMN IF NOT EXISTS whatsapp_template TEXT")
            # companies tablosu önceki deploy'da logo_url'süz oluşmuş olabilir.
            conn.exec_driver_sql("ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)")
            # mail_settings: Gmail API provider'ı için yeni kolonlar (tablo önceki deploy'da oluştu).
            conn.exec_driver_sql("ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'gmail_oauth'")
            conn.exec_driver_sql("ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS google_sa_json_enc TEXT")
            conn.exec_driver_sql("ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS google_client_id VARCHAR(255)")
            conn.exec_driver_sql("ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS google_client_secret_enc TEXT")
            conn.exec_driver_sql("ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS google_refresh_token_enc TEXT")
            # Sık kullanılan filtre/join kolonlarına index (mevcut tablolar için).
            for ddl in (
                "CREATE INDEX IF NOT EXISTS ix_conversations_contact_id ON conversations (contact_id)",
                "CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages (conversation_id)",
                "CREATE INDEX IF NOT EXISTS ix_messages_direction ON messages (direction)",
                "CREATE INDEX IF NOT EXISTS ix_activity_logs_contact_id ON activity_logs (contact_id)",
                "CREATE INDEX IF NOT EXISTS ix_reminders_contact_id ON reminders (contact_id)",
                "CREATE INDEX IF NOT EXISTS ix_contacts_platform ON contacts (platform)",
            ):
                conn.exec_driver_sql(ddl)
    except Exception as e:
        print("Şema migration uyarısı:", e)

    # Tek seferlik veri düzeltmesi: eski hatırlatmalar remind_at'i İstanbul duvar-saati
    # olarak (naive) saklıyordu; artık UTC saklanıyor. Mevcut satırları bir kez 3 saat geri
    # alıp UTC'ye hizala. 'app_meta' işaretçisiyle tekrar çalışması engellenir (idempotent).
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "CREATE TABLE IF NOT EXISTS app_meta (key VARCHAR(80) PRIMARY KEY, value TEXT)"
            )
            done = conn.exec_driver_sql(
                "SELECT 1 FROM app_meta WHERE key = 'reminder_tz_utc_fix'"
            ).first()
            if not done:
                conn.exec_driver_sql(
                    "UPDATE reminders SET remind_at = remind_at - INTERVAL '3 hours' "
                    "WHERE remind_at IS NOT NULL"
                )
                conn.exec_driver_sql(
                    "INSERT INTO app_meta (key, value) VALUES ('reminder_tz_utc_fix', 'done')"
                )
                print("remind_at tek seferlik UTC düzeltmesi uygulandı.")
    except Exception as e:
        print("remind_at tz migration uyarısı:", e)
    http_client = httpx.AsyncClient(timeout=30.0)
    sync_http_client = httpx.Client(timeout=60.0)
    app.state.http = http_client
    app.state.sync_http = sync_http_client
    auto_task = asyncio.create_task(_auto_sync_loop())  # otomatik senkron
    try:
        yield
    finally:
        auto_task.cancel()
        try:
            await auto_task
        except (asyncio.CancelledError, Exception):
            pass
        await http_client.aclose()
        sync_http_client.close()


app = FastAPI(title="CRM API", lifespan=lifespan)

app.include_router(auth_api.router, prefix="/api")
app.include_router(users_api.router, prefix="/api")
app.include_router(dashboard_api.router, prefix="/api")
app.include_router(webhook.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(quick_replies.router, prefix="/api")
app.include_router(statuses.router, prefix="/api")
app.include_router(sectors_api.router, prefix="/api")
app.include_router(training_sets_api.router, prefix="/api")
app.include_router(bank_accounts_api.router, prefix="/api")
app.include_router(payments_api.router, prefix="/api")
app.include_router(advertising_api.router, prefix="/api")
app.include_router(issues_api.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(seminar_forms_api.router, prefix="/api")
app.include_router(public_forms_api.router, prefix="/api")
app.include_router(companies_api.router, prefix="/api")
app.include_router(mail_settings_api.router, prefix="/api")

app.state.sio = sio

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# CORS: ALLOWED_ORIGINS (virgülle ayrık) tanımlıysa onunla kısıtla; boşsa "*" (geriye dönük uyum).
from app.config import ALLOWED_ORIGINS
_origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()] or ["*"]

socket_app = CORSMiddleware(
    socket_app,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)
