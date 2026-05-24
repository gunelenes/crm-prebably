from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import hash_password, require_admin
from app.database import get_db
from app.models import User

router = APIRouter()


@router.get("/users")
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id.asc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": str(u.created_at),
        }
        for u in users
    ]


@router.post("/users")
def create_user(
    body: dict = Body(...),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    full_name = (body.get("full_name") or "").strip() or None
    role = body.get("role") or "user"
    if not username or not password:
        raise HTTPException(status_code=400, detail="Kullanıcı adı ve parola zorunlu")
    if role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Geçersiz rol")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor")
    user = User(
        username=username,
        password_hash=hash_password(password),
        full_name=full_name,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    return {"status": "ok", "id": user.id}


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    body: dict = Body(...),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if "full_name" in body:
        user.full_name = body["full_name"]
    if "role" in body:
        if body["role"] not in ("admin", "user"):
            raise HTTPException(status_code=400, detail="Geçersiz rol")
        user.role = body["role"]
    if "is_active" in body:
        user.is_active = bool(body["is_active"])
    db.commit()
    return {"status": "ok"}


@router.put("/users/{user_id}/password")
def reset_password(
    user_id: int,
    body: dict = Body(...),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    new_password = body.get("password") or ""
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Parola en az 6 karakter olmalı")
    user.password_hash = hash_password(new_password)
    db.commit()
    return {"status": "ok"}
