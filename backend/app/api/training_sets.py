from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TrainingSet, User
from app.auth import get_current_user
from app.utils import iso_utc

router = APIRouter()


@router.get("/training-sets")
def list_training_sets(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(TrainingSet).order_by(TrainingSet.name.asc()).all()
    return [{
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "is_active": t.is_active,
        "created_at": iso_utc(t.created_at),
    } for t in items]


@router.post("/training-sets")
def create_training_set(body: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = (body.get("name") or "").strip()
    if not name:
        return {"error": "Ad zorunlu"}
    item = TrainingSet(
        name=name,
        description=body.get("description"),
        is_active=bool(body.get("is_active", True)),
        created_by_user_id=current_user.id,
    )
    db.add(item)
    db.commit()
    return {"status": "ok", "id": item.id}


@router.put("/training-sets/{ts_id}")
def update_training_set(ts_id: int, body: dict = Body(...), _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(TrainingSet).filter(TrainingSet.id == ts_id).first()
    if not item:
        return {"error": "Bulunamadı"}
    if "name" in body and body["name"]:
        item.name = body["name"]
    if "description" in body:
        item.description = body["description"]
    if "is_active" in body:
        item.is_active = bool(body["is_active"])
    db.commit()
    return {"status": "ok"}


@router.delete("/training-sets/{ts_id}")
def delete_training_set(ts_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(TrainingSet).filter(TrainingSet.id == ts_id).first()
    if not item:
        return {"error": "Bulunamadı"}
    db.delete(item)
    db.commit()
    return {"status": "ok"}
