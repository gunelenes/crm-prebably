from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Sector, User
from app.auth import get_current_user
from app.utils import iso_utc

router = APIRouter()


@router.get("/sectors")
def list_sectors(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sectors = db.query(Sector).order_by(Sector.name.asc()).all()
    return [{
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "is_active": s.is_active,
        "created_at": iso_utc(s.created_at),
    } for s in sectors]


@router.post("/sectors")
def create_sector(body: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = (body.get("name") or "").strip()
    if not name:
        return {"error": "Ad zorunlu"}
    sector = Sector(
        name=name,
        description=body.get("description"),
        is_active=bool(body.get("is_active", True)),
        created_by_user_id=current_user.id,
    )
    db.add(sector)
    db.commit()
    return {"status": "ok", "id": sector.id}


@router.put("/sectors/{sector_id}")
def update_sector(sector_id: int, body: dict = Body(...), _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        return {"error": "Bulunamadı"}
    if "name" in body and body["name"]:
        sector.name = body["name"]
    if "description" in body:
        sector.description = body["description"]
    if "is_active" in body:
        sector.is_active = bool(body["is_active"])
    db.commit()
    return {"status": "ok"}


@router.delete("/sectors/{sector_id}")
def delete_sector(sector_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        return {"error": "Bulunamadı"}
    db.delete(sector)
    db.commit()
    return {"status": "ok"}
