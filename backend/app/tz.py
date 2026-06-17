"""Merkezi saat dilimi yardımcıları — İstanbul (Europe/Istanbul).

İstanbul 2016'dan beri yaz saati (DST) uygulamadığı için sabit UTC+3 offset
kullanılır; bu sayede zoneinfo/tzdata gibi bir bağımlılığa gerek kalmaz.

Konvansiyon: tüm zaman damgaları veritabanında **naive UTC** olarak saklanır
(datetime.utcnow()). "Bugün", "bu ay" gibi gün sınırları ise İstanbul gününe
göre hesaplanır — bu modül o dönüşümleri tek yerde toplar.
"""
from datetime import datetime, date, timedelta, time

# Europe/Istanbul, sabit UTC+3
TR_OFFSET = timedelta(hours=3)


def now_utc() -> datetime:
    """Şu anki zaman, naive UTC."""
    return datetime.utcnow()


def now_tr() -> datetime:
    """Şu anki İstanbul duvar-saati (naive)."""
    return datetime.utcnow() + TR_OFFSET


def today_tr() -> date:
    """Bugünün tarihi, İstanbul'a göre."""
    return (datetime.utcnow() + TR_OFFSET).date()


def tr_day(dt: datetime) -> date:
    """Naive UTC datetime'i İstanbul yerel gününe çevirir."""
    return (dt + TR_OFFSET).date()


def tr_day_start_utc(d: date) -> datetime:
    """Verilen İstanbul günü için, o günün başlangıcının UTC karşılığı (naive)."""
    return datetime.combine(d, time.min) - TR_OFFSET


def tr_today_start_utc() -> datetime:
    """Bugünün (İstanbul) başlangıcının UTC karşılığı (naive)."""
    return tr_day_start_utc(today_tr())


def tr_month_start_utc() -> datetime:
    """İçinde bulunulan ayın (İstanbul) başlangıcının UTC karşılığı (naive)."""
    tr = datetime.utcnow() + TR_OFFSET
    tr_month_start = tr.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return tr_month_start - TR_OFFSET


def parse_iso_to_utc(s) -> datetime:
    """ISO 8601 metnini naive UTC datetime'e çevirir.

    Destekler: 'Z' sonekli (UTC), açık offset'li (ör. +03:00) ve offset'siz
    (naive — İstanbul yerel kabul edilir) girdiler. Geçersizse ValueError.
    """
    if s is None or str(s).strip() == "":
        raise ValueError("Boş tarih")
    txt = str(s).strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(txt)
    if dt.tzinfo is not None:
        # offset'li → UTC'ye çevir, sonra naive yap
        from datetime import timezone
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    # offset yok → İstanbul yerel kabul et, UTC'ye çek
    return dt - TR_OFFSET
