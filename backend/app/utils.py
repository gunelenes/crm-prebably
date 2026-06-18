def iso_utc(dt):
    """UTC datetime'i ISO 8601 + 'Z' formatında döndürür (None ise None).

    Backend her zaman naive UTC datetime kullanıyor (datetime.utcnow()).
    Frontend new Date() ISO + Z görünce otomatik yerel saate çevirir.
    """
    if dt is None:
        return None
    return dt.isoformat() + "Z"


def serialize_user(u):
    """Kullanıcı özet serileştirmesi (advisor_user/created_by için ortak)."""
    return {"id": u.id, "full_name": u.full_name, "username": u.username} if u else None


def serialize_status(s):
    """Statü özet serileştirmesi."""
    return {"id": s.id, "name": s.name, "color": s.color} if s else None


_TR_MAP = str.maketrans({
    "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
    "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c",
})


def slugify_tr(text: str) -> str:
    """Türkçe metni URL slug'a çevirir. Boş veya tamamen geçersiz girdide 'form' döner."""
    if not text:
        return "form"
    s = text.translate(_TR_MAP).lower()
    out = []
    prev_dash = False
    for ch in s:
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif ch in " -_/.":
            if not prev_dash and out:
                out.append("-")
                prev_dash = True
    slug = "".join(out).strip("-")
    return slug[:120] or "form"


def ensure_unique_slug(db, base: str, model, slug_attr: str = "slug", existing_id: int | None = None) -> str:
    """base, base-2, base-3 ... mevcut kayıtlarla çakışmayan ilk slug'ı döner.
    existing_id verilirse o satırın mevcut slug'ı çakışma sayılmaz (düzenleme senaryosu)."""
    col = getattr(model, slug_attr)
    candidate = base
    n = 1
    while True:
        q = db.query(model.id).filter(col == candidate)
        if existing_id is not None:
            q = q.filter(model.id != existing_id)
        if not q.first():
            return candidate
        n += 1
        candidate = f"{base}-{n}"
