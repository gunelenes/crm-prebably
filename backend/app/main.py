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


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client, sync_http_client
    Base.metadata.create_all(bind=engine)
    http_client = httpx.AsyncClient(timeout=30.0)
    sync_http_client = httpx.Client(timeout=60.0)
    app.state.http = http_client
    app.state.sync_http = sync_http_client
    try:
        yield
    finally:
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

socket_app = CORSMiddleware(
    socket_app,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)
