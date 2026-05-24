from decimal import Decimal, InvalidOperation
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Body, Form, File, UploadFile, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, desc, asc
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Payment, Contact, BankAccount, User
from app.auth import get_current_user
from app.utils import iso_utc

router = APIRouter()

MAX_DOC_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}


def _parse_iso(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", ""))
    except Exception:
        raise HTTPException(400, f"Geçersiz tarih: {s}")


def _serialize(p: Payment) -> dict:
    return {
        "id": p.id,
        "type": p.type,
        "contact_id": p.contact_id,
        "contact": {"id": p.contact.id, "name": p.contact.full_name or p.contact.name} if p.contact else None,
        "bank_account_id": p.bank_account_id,
        "bank_account": {
            "id": p.bank_account.id,
            "bank_name": p.bank_account.bank_name,
            "iban": p.bank_account.iban,
        } if p.bank_account else None,
        "amount": float(p.amount) if p.amount is not None else 0.0,
        "currency": p.currency or "TRY",
        "paid_at": iso_utc(p.paid_at),
        "description": p.description,
        "has_document": p.document_data is not None,
        "document_filename": p.document_filename,
        "document_mime": p.document_mime,
        "document_size": p.document_size,
        "created_at": iso_utc(p.created_at),
        "created_by": {"id": p.created_by.id, "full_name": p.created_by.full_name, "username": p.created_by.username} if p.created_by else None,
    }


@router.get("/payments")
def list_payments(
    type: Optional[str] = None,
    contact_id: Optional[int] = None,
    bank_account_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    q: Optional[str] = None,
    sort_by: str = "paid_at",
    sort_dir: str = "desc",
    limit: int = 50,
    offset: int = 0,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    base = db.query(Payment).options(
        joinedload(Payment.contact),
        joinedload(Payment.bank_account),
        joinedload(Payment.created_by),
    )
    if type in ("income", "expense"):
        base = base.filter(Payment.type == type)
    if contact_id:
        base = base.filter(Payment.contact_id == contact_id)
    if bank_account_id:
        base = base.filter(Payment.bank_account_id == bank_account_id)
    if date_from:
        base = base.filter(Payment.paid_at >= _parse_iso(date_from))
    if date_to:
        base = base.filter(Payment.paid_at <= _parse_iso(date_to))
    if q:
        base = base.filter(Payment.description.ilike(f"%{q}%"))

    direction = desc if sort_dir != "asc" else asc
    if sort_by == "amount":
        base = base.order_by(direction(Payment.amount))
    elif sort_by == "created_at":
        base = base.order_by(direction(Payment.created_at))
    else:
        base = base.order_by(direction(Payment.paid_at))

    total = base.with_entities(func.count(Payment.id)).order_by(None).scalar() or 0

    # summary (filtreli set üzerinden)
    income_sum = (base.with_entities(func.coalesce(func.sum(Payment.amount), 0))
                  .filter(Payment.type == "income").order_by(None).scalar()) or 0
    expense_sum = (base.with_entities(func.coalesce(func.sum(Payment.amount), 0))
                   .filter(Payment.type == "expense").order_by(None).scalar()) or 0

    rows = base.limit(limit).offset(offset).all()
    return {
        "total": int(total),
        "summary": {
            "income": float(income_sum),
            "expense": float(expense_sum),
            "net": float(income_sum) - float(expense_sum),
        },
        "items": [_serialize(p) for p in rows],
    }


@router.post("/payments")
async def create_payment(
    type: str = Form(...),
    amount: str = Form(...),
    paid_at: str = Form(...),
    contact_id: Optional[int] = Form(None),
    bank_account_id: Optional[int] = Form(None),
    currency: Optional[str] = Form("TRY"),
    description: Optional[str] = Form(None),
    document: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if type not in ("income", "expense"):
        raise HTTPException(400, "Geçersiz tip")
    if type == "income" and not contact_id:
        raise HTTPException(400, "Gelir kaydında kişi zorunlu")
    try:
        amount_dec = Decimal(amount)
    except InvalidOperation:
        raise HTTPException(400, "Geçersiz tutar")
    if amount_dec <= 0:
        raise HTTPException(400, "Tutar 0'dan büyük olmalı")

    p = Payment(
        type=type,
        contact_id=contact_id if type == "income" else None,
        bank_account_id=bank_account_id,
        amount=amount_dec,
        currency=(currency or "TRY")[:3].upper(),
        paid_at=_parse_iso(paid_at),
        description=description,
        created_by_user_id=current_user.id,
    )

    if document is not None and document.filename:
        data = await document.read()
        if len(data) > MAX_DOC_SIZE:
            raise HTTPException(400, "Dosya 10MB'tan büyük olamaz")
        mime = (document.content_type or "").lower()
        if mime not in ALLOWED_MIME:
            raise HTTPException(400, "Sadece PDF, JPG veya PNG yüklenebilir")
        p.document_data = data
        p.document_filename = document.filename
        p.document_mime = mime
        p.document_size = len(data)

    db.add(p)
    db.commit()
    db.refresh(p)
    return {"status": "ok", "id": p.id}


@router.put("/payments/{payment_id}")
def update_payment(
    payment_id: int,
    body: dict = Body(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        return {"error": "Bulunamadı"}
    if "type" in body and body["type"] in ("income", "expense"):
        p.type = body["type"]
    if "contact_id" in body:
        p.contact_id = body["contact_id"] or None
    if "bank_account_id" in body:
        p.bank_account_id = body["bank_account_id"] or None
    if "amount" in body:
        try:
            p.amount = Decimal(str(body["amount"]))
        except InvalidOperation:
            raise HTTPException(400, "Geçersiz tutar")
    if "currency" in body and body["currency"]:
        p.currency = body["currency"][:3].upper()
    if "paid_at" in body and body["paid_at"]:
        p.paid_at = _parse_iso(body["paid_at"])
    if "description" in body:
        p.description = body["description"]

    if p.type == "income" and not p.contact_id:
        raise HTTPException(400, "Gelir kaydında kişi zorunlu")

    db.commit()
    return {"status": "ok"}


@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        return {"error": "Bulunamadı"}
    db.delete(p)
    db.commit()
    return {"status": "ok"}


@router.post("/payments/{payment_id}/document")
async def upload_document(
    payment_id: int,
    document: UploadFile = File(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(404, "Ödeme bulunamadı")
    data = await document.read()
    if len(data) > MAX_DOC_SIZE:
        raise HTTPException(400, "Dosya 10MB'tan büyük olamaz")
    mime = (document.content_type or "").lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(400, "Sadece PDF, JPG veya PNG yüklenebilir")
    p.document_data = data
    p.document_filename = document.filename
    p.document_mime = mime
    p.document_size = len(data)
    db.commit()
    return {"status": "ok"}


@router.delete("/payments/{payment_id}/document")
def delete_document(payment_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        return {"error": "Bulunamadı"}
    p.document_data = None
    p.document_filename = None
    p.document_mime = None
    p.document_size = None
    db.commit()
    return {"status": "ok"}


@router.get("/payments/{payment_id}/document")
def get_document(payment_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p or not p.document_data:
        raise HTTPException(404, "Belge yok")
    headers = {
        "Content-Disposition": f'inline; filename="{p.document_filename or "belge"}"',
    }
    return Response(
        content=bytes(p.document_data),
        media_type=p.document_mime or "application/octet-stream",
        headers=headers,
    )
