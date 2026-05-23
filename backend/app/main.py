import socketio
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from app.database import engine
from app.models import Base
from app.api import webhook, messages, quick_replies, statuses, contacts

Base.metadata.create_all(bind=engine)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

app = FastAPI(title="CRM API")

app.include_router(webhook.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(quick_replies.router, prefix="/api")
app.include_router(statuses.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")

app.state.sio = sio

# Önce socket_app oluştur
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Sonra CORS ekle
socket_app = CORSMiddleware(
    socket_app,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)