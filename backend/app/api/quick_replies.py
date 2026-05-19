from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import QuickReply

router = APIRouter()

@router.get("/quick-replies")
def get_quick_replies(db: Session = Depends(get_db)):
    replies = db.query(QuickReply).order_by(QuickReply.id.asc()).all()
    return [{"id": r.id, "title": r.title, "content": r.content} for r in replies]

@router.post("/quick-replies")
async def create_quick_reply(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    reply = QuickReply(title=body.get("title"), content=body.get("content"))
    db.add(reply)
    db.commit()
    return {"status": "ok", "id": reply.id}

@router.put("/quick-replies/{reply_id}")
async def update_quick_reply(reply_id: int, request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    reply = db.query(QuickReply).filter(QuickReply.id == reply_id).first()
    if not reply:
        return {"error": "Bulunamadı"}
    reply.title = body.get("title", reply.title)
    reply.content = body.get("content", reply.content)
    db.commit()
    return {"status": "ok"}

@router.delete("/quick-replies/{reply_id}")
def delete_quick_reply(reply_id: int, db: Session = Depends(get_db)):
    reply = db.query(QuickReply).filter(QuickReply.id == reply_id).first()
    if not reply:
        return {"error": "Bulunamadı"}
    db.delete(reply)
    db.commit()
    return {"status": "ok"}