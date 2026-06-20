"""Tersine çevrilebilir basit şifreleme — Mail Ayarları'ndaki App Password gibi
DB'de saklanması gereken sırlar için.

Anahtar mevcut JWT_SECRET'tan türetilir (ayrı bir env değişkeni gerekmez). JWT_SECRET
değişirse eski şifreli değerler çözülemez (decrypt "" döner) → ilgili sır yeniden girilir."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import JWT_SECRET


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256((JWT_SECRET or "").encode()).digest())
    return Fernet(key)


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode() if plain else ""


def decrypt(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return ""
