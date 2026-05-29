import re

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, hash_password, require_admin
from app.database import get_db
from app.models import User
from app.utils import iso_utc

router = APIRouter()

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(raw):
    """Boş/None ise None döner; doluysa doğrular ve küçük harfe çevirir."""
    email = (raw or "").strip().lower()
    if not email:
        return None
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Geçersiz e-posta adresi")
    return email


@router.get("/users/active")
def list_active_users(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Tüm authenticated kullanıcılar için: aktif kullanıcı listesi (danışman dropdown'u)."""
    users = (db.query(User)
             .filter(User.is_active == True)
             .order_by(User.full_name.asc(), User.username.asc())
             .all())
    return [
        {"id": u.id, "username": u.username, "full_name": u.full_name, "email": u.email, "role": u.role}
        for u in users
    ]


@router.get("/users")
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id.asc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": iso_utc(u.created_at),
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
    email = _normalize_email(body.get("email"))
    role = body.get("role") or "user"
    if not username or not password:
        raise HTTPException(status_code=400, detail="Kullanıcı adı ve parola zorunlu")
    if role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Geçersiz rol")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor")
    if email and db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kullanılıyor")
    user = User(
        username=username,
        password_hash=hash_password(password),
        full_name=full_name,
        email=email,
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
    if "email" in body:
        email = _normalize_email(body.get("email"))
        if email and db.query(User).filter(User.email == email, User.id != user_id).first():
            raise HTTPException(status_code=400, detail="Bu e-posta zaten kullanılıyor")
        user.email = email
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
