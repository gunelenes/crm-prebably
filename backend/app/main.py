import asyncio
from contextlib import asynccontextmanager
import httpx
import socketio
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from app.database import engine
from app.models import Base
from app.api import webhook, messages, quick_replies, statuses, contacts, auth as auth_api, users as users_api, sectors as sectors_api, training_sets as training_sets_api, bank_accounts as bank_accounts_api, payments as payments_api, dashboard as dashboard_api, advertising as advertising_api

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
    # Hafif şema evrimi: create_all mevcut tabloları ALTER etmez. Idempotent (IF NOT EXISTS).
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "ALTER TABLE contact_links ADD COLUMN IF NOT EXISTS primary_contact_id INTEGER"
            )
    except Exception as e:
        print("Şema migration uyarısı:", e)
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
app.include_router(contacts.router, prefix="/api")

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
