from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import BankAccount, User
from app.auth import require_admin
from app.utils import iso_utc

router = APIRouter()


@router.get("/bank-accounts")
def list_bank_accounts(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    items = db.query(BankAccount).order_by(BankAccount.bank_name.asc()).all()
    return [{
        "id": b.id,
        "bank_name": b.bank_name,
        "iban": b.iban,
        "account_holder": b.account_holder,
        "description": b.description,
        "is_active": b.is_active,
        "created_at": iso_utc(b.created_at),
    } for b in items]


@router.post("/bank-accounts")
def create_bank_account(body: dict = Body(...), current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    bank_name = (body.get("bank_name") or "").strip()
    iban = (body.get("iban") or "").strip().replace(" ", "")
    if not bank_name or not iban:
        return {"error": "Banka adı ve IBAN zorunlu"}
    item = BankAccount(
        bank_name=bank_name,
        iban=iban,
        account_holder=body.get("account_holder"),
        description=body.get("description"),
        is_active=bool(body.get("is_active", True)),
        created_by_user_id=current_user.id,
    )
    db.add(item)
    db.commit()
    return {"status": "ok", "id": item.id}


@router.put("/bank-accounts/{ba_id}")
def update_bank_account(ba_id: int, body: dict = Body(...), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.query(BankAccount).filter(BankAccount.id == ba_id).first()
    if not item:
        return {"error": "Bulunamadı"}
    if "bank_name" in body and body["bank_name"]:
        item.bank_name = body["bank_name"]
    if "iban" in body and body["iban"]:
        item.iban = body["iban"].replace(" ", "")
    if "account_holder" in body:
        item.account_holder = body["account_holder"]
    if "description" in body:
        item.description = body["description"]
    if "is_active" in body:
        item.is_active = bool(body["is_active"])
    db.commit()
    return {"status": "ok"}


@router.delete("/bank-accounts/{ba_id}")
def delete_bank_account(ba_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.query(BankAccount).filter(BankAccount.id == ba_id).first()
    if not item:
        return {"error": "Bulunamadı"}
    db.delete(item)
    db.commit()
    return {"status": "ok"}
