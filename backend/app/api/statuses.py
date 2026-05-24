from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Status, Contact

router = APIRouter()

@router.get("/statuses")
def get_statuses(db: Session = Depends(get_db)):
    statuses = db.query(Status).order_by(Status.id.asc()).all()
    return [{"id": s.id, "name": s.name, "color": s.color, "is_active": s.is_active} for s in statuses]

@router.post("/statuses")
def create_status(body: dict = Body(...), db: Session = Depends(get_db)):
    status = Status(name=body.get("name"), color=body.get("color", "#6B7280"))
    db.add(status)
    db.commit()
    return {"status": "ok", "id": status.id}

@router.put("/statuses/{status_id}")
def update_status(status_id: int, body: dict = Body(...), db: Session = Depends(get_db)):
    status = db.query(Status).filter(Status.id == status_id).first()
    if not status:
        return {"error": "Bulunamadı"}
    status.name = body.get("name", status.name)
    status.color = body.get("color", status.color)
    status.is_active = body.get("is_active", status.is_active)
    db.commit()
    return {"status": "ok"}

@router.delete("/statuses/{status_id}")
def delete_status(status_id: int, db: Session = Depends(get_db)):
    status = db.query(Status).filter(Status.id == status_id).first()
    if not status:
        return {"error": "Bulunamadı"}
    db.delete(status)
    db.commit()
    return {"status": "ok"}
