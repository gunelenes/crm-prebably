from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Creative, User
from app.auth import get_current_user
from app.utils import iso_utc

router = APIRouter()


@router.get("/creatives")
def list_creatives(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    creatives = db.query(Creative).order_by(Creative.name.asc()).all()
    return [{
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "is_active": c.is_active,
        "created_at": iso_utc(c.created_at),
    } for c in creatives]


@router.post("/creatives")
def create_creative(body: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = (body.get("name") or "").strip()
    if not name:
        return {"error": "Ad zorunlu"}
    creative = Creative(
        name=name,
        description=body.get("description"),
        is_active=bool(body.get("is_active", True)),
        created_by_user_id=current_user.id,
    )
    db.add(creative)
    db.commit()
    return {"status": "ok", "id": creative.id}


@router.put("/creatives/{creative_id}")
def update_creative(creative_id: int, body: dict = Body(...), _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    creative = db.query(Creative).filter(Creative.id == creative_id).first()
    if not creative:
        return {"error": "Bulunamadı"}
    if "name" in body and body["name"]:
        creative.name = body["name"]
    if "description" in body:
        creative.description = body["description"]
    if "is_active" in body:
        creative.is_active = bool(body["is_active"])
    db.commit()
    return {"status": "ok"}


@router.delete("/creatives/{creative_id}")
def delete_creative(creative_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    creative = db.query(Creative).filter(Creative.id == creative_id).first()
    if not creative:
        return {"error": "Bulunamadı"}
    db.delete(creative)
    db.commit()
    return {"status": "ok"}
