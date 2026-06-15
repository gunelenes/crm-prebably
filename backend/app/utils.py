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
