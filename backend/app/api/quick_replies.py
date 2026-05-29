from fastapi import APIRouter, Depends, Body, File, UploadFile, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import QuickReply, User
from app.auth import get_current_user

router = APIRouter()

MAX_AUDIO_SIZE = 5 * 1024 * 1024  # 5 MB
# Instagram'ın güvenle kabul ettiği formatlar + tarayıcı kaydı (webm/ogg) için izin.
# webm/ogg gönderimi Instagram tarafında reddedilebilir; o durumda sunucuda dönüştürme gerekir.
ALLOWED_AUDIO_MIME = {
    "audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a", "audio/x-m4a",
    "audio/aac", "audio/wav", "audio/webm", "audio/ogg",
}


@router.get("/quick-replies")
def get_quick_replies(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    replies = db.query(QuickReply).order_by(QuickReply.id.asc()).all()
    return [{
        "id": r.id,
        "title": r.title,
        "content": r.content,
        "has_audio": r.audio_data is not None,
        "audio_mime": r.audio_mime,
        "audio_size": r.audio_size,
    } for r in replies]


@router.post("/quick-replies")
def create_quick_reply(body: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "Başlık zorunlu")
    reply = QuickReply(
        title=title,
        content=body.get("content"),
        created_by_user_id=current_user.id,
    )
    db.add(reply)
    db.commit()
    return {"status": "ok", "id": reply.id}


@router.put("/quick-replies/{reply_id}")
def update_quick_reply(reply_id: int, body: dict = Body(...), _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reply = db.query(QuickReply).filter(QuickReply.id == reply_id).first()
    if not reply:
        return {"error": "Bulunamadı"}
    if "title" in body:
        reply.title = body.get("title", reply.title)
    if "content" in body:
        reply.content = body.get("content")
    db.commit()
    return {"status": "ok"}


@router.delete("/quick-replies/{reply_id}")
def delete_quick_reply(reply_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reply = db.query(QuickReply).filter(QuickReply.id == reply_id).first()
    if not reply:
        return {"error": "Bulunamadı"}
    db.delete(reply)
    db.commit()
    return {"status": "ok"}


@router.post("/quick-replies/{reply_id}/audio")
async def upload_audio(
    reply_id: int,
    audio: UploadFile = File(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reply = db.query(QuickReply).filter(QuickReply.id == reply_id).first()
    if not reply:
        raise HTTPException(404, "Hazır mesaj bulunamadı")
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Boş dosya")
    if len(data) > MAX_AUDIO_SIZE:
        raise HTTPException(400, "Ses dosyası 5MB'tan büyük olamaz")
    mime = (audio.content_type or "").split(";")[0].strip().lower()
    if mime not in ALLOWED_AUDIO_MIME:
        raise HTTPException(400, f"Desteklenmeyen ses formatı: {mime or 'bilinmiyor'}")
    reply.audio_data = data
    reply.audio_filename = audio.filename
    reply.audio_mime = mime
    reply.audio_size = len(data)
    db.commit()
    return {"status": "ok", "audio_mime": mime, "audio_size": len(data)}


@router.delete("/quick-replies/{reply_id}/audio")
def delete_audio(reply_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reply = db.query(QuickReply).filter(QuickReply.id == reply_id).first()
    if not reply:
        return {"error": "Bulunamadı"}
    reply.audio_data = None
    reply.audio_filename = None
    reply.audio_mime = None
    reply.audio_size = None
    db.commit()
    return {"status": "ok"}


# DİKKAT: Bu endpoint bilerek auth'suz (public). Instagram/Meta giden sesi
# bu adresten sunucu tarafında çeker; gönderdiği isteğe token ekleyemeyiz.
# Frontend'deki <audio> oynatıcı da aynı adresi kullanır.
@router.get("/quick-replies/{reply_id}/audio")
def get_audio(reply_id: int, db: Session = Depends(get_db)):
    reply = db.query(QuickReply).filter(QuickReply.id == reply_id).first()
    if not reply or not reply.audio_data:
        raise HTTPException(404, "Ses yok")
    return Response(
        content=bytes(reply.audio_data),
        media_type=reply.audio_mime or "audio/mpeg",
        headers={
            "Content-Disposition": f'inline; filename="{reply.audio_filename or "ses"}"',
            "Cache-Control": "public, max-age=86400",
        },
    )
