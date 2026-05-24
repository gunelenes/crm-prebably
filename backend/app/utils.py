def iso_utc(dt):
    """UTC datetime'i ISO 8601 + 'Z' formatında döndürür (None ise None).

    Backend her zaman naive UTC datetime kullanıyor (datetime.utcnow()).
    Frontend new Date() ISO + Z görünce otomatik yerel saate çevirir.
    """
    if dt is None:
        return None
    return dt.isoformat() + "Z"
