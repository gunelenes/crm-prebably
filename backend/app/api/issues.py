from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Body, Form, File, UploadFile, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, desc, asc
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import BugReport, BugAttachment, User
from app.auth import get_current_user
from app.utils import iso_utc, serialize_user

router = APIRouter()

MAX_IMG_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
MAX_ATTACHMENTS = 10  # bir hata kaydına en fazla ekran görüntüsü

STATUSES = {"acik", "cozuldu"}
PRIORITIES = {"dusuk", "orta", "yuksek"}


def _serialize(b: BugReport) -> dict:
    return {
        "id": b.id,
        "title": b.title,
        "description": b.description,
        "status": b.status,
        "priority": b.priority,
        "page": b.page,
        "created_at": iso_utc(b.created_at),
        "updated_at": iso_utc(b.updated_at),
        "resolved_at": iso_utc(b.resolved_at),
        "created_by": serialize_user(b.created_by),
        "resolved_by": serialize_user(b.resolved_by),
        "attachments": [
            {
                "id": a.id,
                "filename": a.filename,
                "mime": a.mime,
                "size": a.size,
            }
            for a in b.attachments
        ],
    }


async def _read_image(f: UploadFile) -> tuple[bytes, str]:
    """Yüklenen görseli doğrular; (data, mime) döner."""
    data = await f.read()
    if not data:
        raise HTTPException(400, "Boş dosya")
    if len(data) > MAX_IMG_SIZE:
        raise HTTPException(400, "Görsel 10MB'tan büyük olamaz")
    mime = (f.content_type or "").lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(400, "Sadece JPG, PNG, WEBP veya GIF yüklenebilir")
    return data, mime


@router.get("/bugs")
def list_bugs(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    q: Optional[str] = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    limit: int = 50,
    offset: int = 0,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    base = db.query(BugReport).options(
        joinedload(BugReport.attachments),
        joinedload(BugReport.created_by),
        joinedload(BugReport.resolved_by),
    )
    if status in STATUSES:
        base = base.filter(BugReport.status == status)
    if priority in PRIORITIES:
        base = base.filter(BugReport.priority == priority)
    if q:
        like = f"%{q}%"
        base = base.filter(
            (BugReport.title.ilike(like))
            | (BugReport.description.ilike(like))
            | (BugReport.page.ilike(like))
        )

    direction = desc if sort_dir != "asc" else asc
    if sort_by == "updated_at":
        base = base.order_by(direction(BugReport.updated_at))
    else:
        base = base.order_by(direction(BugReport.created_at))

    total = base.with_entities(func.count(BugReport.id)).order_by(None).scalar() or 0

    # Özet: durum bazlı sayımlar (filtreden bağımsız genel sayaç)
    counts = dict(
        db.query(BugReport.status, func.count(BugReport.id)).group_by(BugReport.status).all()
    )

    rows = base.limit(limit).offset(offset).all()
    return {
        "total": int(total),
        "summary": {
            "acik": int(counts.get("acik", 0)),
            "cozuldu": int(counts.get("cozuldu", 0)),
            "toplam": int(sum(counts.values())),
        },
        "items": [_serialize(b) for b in rows],
    }


@router.get("/bugs/{bug_id}")
def get_bug(bug_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(BugReport).filter(BugReport.id == bug_id).first()
    if not b:
        raise HTTPException(404, "Hata kaydı bulunamadı")
    return _serialize(b)


@router.post("/bugs")
async def create_bug(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    priority: Optional[str] = Form("orta"),
    page: Optional[str] = Form(None),
    screenshots: List[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = (title or "").strip()
    if not title:
        raise HTTPException(400, "Başlık zorunlu")
    if priority not in PRIORITIES:
        priority = "orta"

    files = [f for f in (screenshots or []) if f and f.filename]
    if len(files) > MAX_ATTACHMENTS:
        raise HTTPException(400, f"En fazla {MAX_ATTACHMENTS} ekran görüntüsü eklenebilir")

    b = BugReport(
        title=title,
        description=(description or None),
        status="acik",
        priority=priority,
        page=(page or None),
        created_by_user_id=current_user.id,
    )
    for f in files:
        data, mime = await _read_image(f)
        b.attachments.append(
            BugAttachment(image_data=data, mime=mime, filename=f.filename, size=len(data))
        )

    db.add(b)
    db.commit()
    db.refresh(b)
    return {"status": "ok", "id": b.id}


@router.put("/bugs/{bug_id}")
def update_bug(
    bug_id: int,
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = db.query(BugReport).filter(BugReport.id == bug_id).first()
    if not b:
        raise HTTPException(404, "Hata kaydı bulunamadı")

    if "title" in body:
        t = (body["title"] or "").strip()
        if not t:
            raise HTTPException(400, "Başlık zorunlu")
        b.title = t
    if "description" in body:
        b.description = body["description"] or None
    if "priority" in body and body["priority"] in PRIORITIES:
        b.priority = body["priority"]
    if "page" in body:
        b.page = body["page"] or None
    if "status" in body and body["status"] in STATUSES:
        if body["status"] != b.status:
            b.status = body["status"]
            if b.status == "cozuldu":
                b.resolved_at = datetime.utcnow()
                b.resolved_by_user_id = current_user.id
            else:
                b.resolved_at = None
                b.resolved_by_user_id = None

    db.commit()
    db.refresh(b)
    return {"status": "ok"}


@router.delete("/bugs/{bug_id}")
def delete_bug(bug_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(BugReport).filter(BugReport.id == bug_id).first()
    if not b:
        return {"error": "Bulunamadı"}
    db.delete(b)  # cascade ile ekran görüntüleri de silinir
    db.commit()
    return {"status": "ok"}


@router.post("/bugs/{bug_id}/attachments")
async def add_attachments(
    bug_id: int,
    screenshots: List[UploadFile] = File(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = db.query(BugReport).filter(BugReport.id == bug_id).first()
    if not b:
        raise HTTPException(404, "Hata kaydı bulunamadı")

    files = [f for f in (screenshots or []) if f and f.filename]
    if not files:
        raise HTTPException(400, "Dosya yok")
    if len(b.attachments) + len(files) > MAX_ATTACHMENTS:
        raise HTTPException(400, f"En fazla {MAX_ATTACHMENTS} ekran görüntüsü eklenebilir")

    for f in files:
        data, mime = await _read_image(f)
        b.attachments.append(
            BugAttachment(image_data=data, mime=mime, filename=f.filename, size=len(data))
        )
    db.commit()
    return {"status": "ok"}


@router.get("/bugs/{bug_id}/attachments/{att_id}")
def get_attachment(
    bug_id: int,
    att_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = (
        db.query(BugAttachment)
        .filter(BugAttachment.id == att_id, BugAttachment.bug_id == bug_id)
        .first()
    )
    if not a or not a.image_data:
        raise HTTPException(404, "Görsel yok")
    return Response(
        content=bytes(a.image_data),
        media_type=a.mime or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{a.filename or "ekran-goruntusu"}"'},
    )


@router.delete("/bugs/{bug_id}/attachments/{att_id}")
def delete_attachment(
    bug_id: int,
    att_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = (
        db.query(BugAttachment)
        .filter(BugAttachment.id == att_id, BugAttachment.bug_id == bug_id)
        .first()
    )
    if not a:
        return {"error": "Bulunamadı"}
    db.delete(a)
    db.commit()
    return {"status": "ok"}
