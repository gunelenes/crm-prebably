import os
import subprocess
import tempfile

from fastapi import APIRouter, Depends, Body, File, UploadFile, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import QuickReply, User
from app.auth import get_current_user

router = APIRouter()

MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25 MB (Instagram ses limiti)

# Instagram ses için yalnızca aac/m4a/wav/mp4 kabul ediyor; mp3 ve tarayıcı kaydı (webm)
# reddediliyor. Bu yüzden YÜKLENEN her şeyi AAC sesli .m4a'ya dönüştürüp öyle saklıyoruz.
# Dönüştürülmüş çıktının mime'ı her zaman audio/mp4 olur.
OUTPUT_AUDIO_MIME = "audio/mp4"


def transcode_to_m4a(data: bytes) -> bytes:
    """Herhangi bir ses (mp3/webm/ogg/wav...) → Instagram uyumlu AAC/.m4a.

    imageio-ffmpeg ile gelen statik ffmpeg ikilisini kullanır (sistem kurulumu gerekmez).
    +faststart: moov atom'unu başa alır ki Meta dosyayı stream ederek okuyabilsin.
    """
    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory() as d:
        inp = os.path.join(d, "input")
        out = os.path.join(d, "output.m4a")
        with open(inp, "wb") as f:
            f.write(data)
        cmd = [
            ffmpeg, "-y", "-i", inp,
            "-vn",                      # video akışını at (kapak resmi vb.)
            "-c:a", "aac", "-b:a", "96k",
            "-movflags", "+faststart",
            out,
        ]
        proc = subprocess.run(cmd, capture_output=True)
        if proc.returncode != 0 or not os.path.exists(out) or os.path.getsize(out) == 0:
            detail = proc.stderr.decode(errors="ignore")[-400:]
            raise HTTPException(400, f"Ses dönüştürülemedi: {detail}")
        with open(out, "rb") as f:
            return f.read()


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
        raise HTTPException(400, "Ses dosyası 25MB'tan büyük olamaz")

    # Her formatı Instagram uyumlu .m4a'ya dönüştür.
    m4a = transcode_to_m4a(data)

    base = os.path.splitext(audio.filename or "ses")[0]
    reply.audio_data = m4a
    reply.audio_filename = f"{base}.m4a"
    reply.audio_mime = OUTPUT_AUDIO_MIME
    reply.audio_size = len(m4a)
    db.commit()
    return {"status": "ok", "audio_mime": OUTPUT_AUDIO_MIME, "audio_size": len(m4a)}


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
        media_type=reply.audio_mime or OUTPUT_AUDIO_MIME,
        headers={
            "Content-Disposition": f'inline; filename="{reply.audio_filename or "ses"}"',
            "Cache-Control": "public, max-age=86400",
        },
    )
