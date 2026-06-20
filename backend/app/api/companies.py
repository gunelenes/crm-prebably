"""Şirket Bilgileri CRUD — Parametreler ekranından yönetilir.

Seminer formlarında gönderen kimliği olarak kullanılır (şirket adı + e-posta).
Listeleme herhangi bir kullanıcıya açık (form builder okuyabilsin); ekleme/güncelleme/
silme yalnızca admin."""

from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Company, User
from app.auth import get_current_user, require_admin
from app.utils import iso_utc

router = APIRouter()


def _serialize(c: Company) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "email": c.email,
        "logo_url": c.logo_url,
        "is_active": c.is_active,
        "created_at": iso_utc(c.created_at),
    }


@router.get("/companies")
def list_companies(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(Company).order_by(Company.name.asc()).all()
    return [_serialize(c) for c in items]


@router.post("/companies")
def create_company(body: dict = Body(...), current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    if not name or not email:
        return {"error": "Şirket adı ve e-posta zorunlu"}
    item = Company(
        name=name,
        email=email,
        logo_url=(body.get("logo_url") or "").strip() or None,
        is_active=bool(body.get("is_active", True)),
        created_by_user_id=current_user.id,
    )
    db.add(item)
    db.commit()
    return {"status": "ok", "id": item.id}


@router.put("/companies/{cid}")
def update_company(cid: int, body: dict = Body(...), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.query(Company).filter(Company.id == cid).first()
    if not item:
        return {"error": "Bulunamadı"}
    if "name" in body and body["name"]:
        item.name = body["name"].strip()
    if "email" in body and body["email"]:
        item.email = body["email"].strip().lower()
    if "logo_url" in body:
        item.logo_url = (body.get("logo_url") or "").strip() or None
    if "is_active" in body:
        item.is_active = bool(body["is_active"])
    db.commit()
    return {"status": "ok"}


@router.delete("/companies/{cid}")
def delete_company(cid: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.query(Company).filter(Company.id == cid).first()
    if not item:
        return {"error": "Bulunamadı"}
    db.delete(item)
    db.commit()
    return {"status": "ok"}
