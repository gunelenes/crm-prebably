import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import webhook, messages
from app.database import engine
from app.models import Base
from app.api import webhook, messages, quick_replies
from app.api import webhook, messages, quick_replies, statuses
from app.api import webhook, messages, quick_replies, statuses, contacts

Base.metadata.create_all(bind=engine)

# Socket.io
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

app = FastAPI(title="CRM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://awake-elegance-production-8d06.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(quick_replies.router, prefix="/api")
app.include_router(statuses.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")


# Socket.io'yu FastAPI'ye bağla
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

@sio.event
async def connect(sid, environ):
    print(f"Client bağlandı: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client ayrıldı: {sid}")

# sio'yu webhook'tan erişilebilir yap
app.state.sio = sio


