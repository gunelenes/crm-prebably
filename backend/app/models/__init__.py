from app.database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Boolean, ForeignKey, Enum, Numeric, LargeBinary, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name     = Column(String(100))
    email         = Column(String(255), unique=True, nullable=True, index=True)
    role          = Column(String(20), default="user")  # 'admin' | 'user'
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

class Status(Base):
    __tablename__ = "statuses"
    id                  = Column(Integer, primary_key=True, index=True)
    name                = Column(String(100))
    color               = Column(String(20), default="#6B7280")
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class Sector(Base):
    __tablename__ = "sectors"
    id                  = Column(Integer, primary_key=True, index=True)
    name                = Column(String(100), nullable=False)
    description         = Column(Text, nullable=True)
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class TrainingSet(Base):
    __tablename__ = "training_sets"
    id                  = Column(Integer, primary_key=True, index=True)
    name                = Column(String(100), nullable=False)
    description         = Column(Text, nullable=True)
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class Contact(Base):
    __tablename__ = "contacts"
    id                    = Column(Integer, primary_key=True, index=True)
    platform              = Column(String(20))
    external_id           = Column(String(500), unique=True)
    name                  = Column(String(100))
    full_name             = Column(String(100), nullable=True)
    phone                 = Column(String(20), nullable=True)
    email                 = Column(String(255), nullable=True)
    description           = Column(Text, nullable=True)
    knows_us              = Column(Boolean, default=False)
    previous_trainings    = Column(Text, nullable=True)
    purchase_potential = Column(Enum('düşük', 'orta', 'yüksek', name='purchase_potential_enum'), nullable=True)
    had_training          = Column(Boolean, default=False)
    purchased             = Column(Boolean, default=False)
    reason_not_purchased  = Column(Text, nullable=True)
    assigned_to           = Column(String(100), nullable=True)
    assigned_to_user_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    status_id             = Column(Integer, ForeignKey("statuses.id"), nullable=True)
    sector_id             = Column(Integer, ForeignKey("sectors.id"), nullable=True)
    training_set_id       = Column(Integer, ForeignKey("training_sets.id"), nullable=True)
    created_at            = Column(DateTime, default=datetime.utcnow)
    created_by_user_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    status                = relationship("Status")
    sector                = relationship("Sector", foreign_keys=[sector_id])
    training_set          = relationship("TrainingSet", foreign_keys=[training_set_id])
    assigned_to_user      = relationship("User", foreign_keys=[assigned_to_user_id])
    created_by            = relationship("User", foreign_keys=[created_by_user_id])
    conversations         = relationship("Conversation", back_populates="contact")
    activity_logs         = relationship("ActivityLog", back_populates="contact")
    reminders             = relationship("Reminder", back_populates="contact")
    payments              = relationship("Payment", back_populates="contact")

class Conversation(Base):
    __tablename__ = "conversations"
    id                  = Column(Integer, primary_key=True, index=True)
    contact_id          = Column(Integer, ForeignKey("contacts.id"))
    platform            = Column(String(20))
    unread_count        = Column(Integer, default=0)
    last_message_at     = Column(DateTime, default=datetime.utcnow)
    reply_dismissed_at  = Column(DateTime, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    contact             = relationship("Contact", back_populates="conversations")
    created_by          = relationship("User", foreign_keys=[created_by_user_id])
    messages            = relationship("Message", back_populates="conversation")

class Message(Base):
    __tablename__ = "messages"
    id                  = Column(Integer, primary_key=True, index=True)
    conversation_id     = Column(Integer, ForeignKey("conversations.id"))
    direction           = Column(String(10))
    content             = Column(Text)
    message_type        = Column(String(20), default="text")
    platform            = Column(String(20))
    external_id         = Column(String(500), nullable=True)
    quick_reply_id      = Column(Integer, ForeignKey("quick_replies.id"), nullable=True)
    media_data          = Column(LargeBinary, nullable=True)
    media_mime          = Column(String(100), nullable=True)
    media_size          = Column(Integer, nullable=True)
    is_read             = Column(Boolean, default=False)
    timestamp           = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    conversation        = relationship("Conversation", back_populates="messages")
    quick_reply         = relationship("QuickReply", foreign_keys=[quick_reply_id])
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id                  = Column(Integer, primary_key=True, index=True)
    contact_id          = Column(Integer, ForeignKey("contacts.id"))
    type                = Column(String(50))
    title               = Column(String(200))
    description         = Column(Text, nullable=True)
    old_status_id       = Column(Integer, nullable=True)
    new_status_id       = Column(Integer, nullable=True)
    advisor             = Column(String(100), nullable=True)
    advisor_user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    contact             = relationship("Contact", back_populates="activity_logs")
    advisor_user        = relationship("User", foreign_keys=[advisor_user_id])
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class Reminder(Base):
    __tablename__ = "reminders"
    id                  = Column(Integer, primary_key=True, index=True)
    contact_id          = Column(Integer, ForeignKey("contacts.id"))
    title               = Column(String(200))
    description         = Column(Text, nullable=True)
    remind_at           = Column(DateTime)
    is_done             = Column(Boolean, default=False)
    advisor             = Column(String(100), nullable=True)
    advisor_user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    contact             = relationship("Contact", back_populates="reminders")
    advisor_user        = relationship("User", foreign_keys=[advisor_user_id])
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class QuickReply(Base):
    __tablename__ = "quick_replies"
    id                  = Column(Integer, primary_key=True, index=True)
    title               = Column(String(100))
    content             = Column(Text, nullable=True)
    audio_data          = Column(LargeBinary, nullable=True)
    audio_mime          = Column(String(50), nullable=True)
    audio_filename      = Column(String(255), nullable=True)
    audio_size          = Column(Integer, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class BankAccount(Base):
    __tablename__ = "bank_accounts"
    id                  = Column(Integer, primary_key=True, index=True)
    bank_name           = Column(String(100), nullable=False)
    iban                = Column(String(50), nullable=False)
    account_holder      = Column(String(150), nullable=True)
    description         = Column(Text, nullable=True)
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class Payment(Base):
    __tablename__ = "payments"
    id                  = Column(Integer, primary_key=True, index=True)
    type                = Column(String(20), nullable=False)  # 'income' | 'expense'
    contact_id          = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    bank_account_id     = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)
    amount              = Column(Numeric(12, 2), nullable=False)
    currency            = Column(String(3), default="TRY")
    paid_at             = Column(DateTime, nullable=False)
    description         = Column(Text, nullable=True)
    document_filename   = Column(String(255), nullable=True)
    document_mime       = Column(String(50), nullable=True)
    document_size       = Column(Integer, nullable=True)
    document_data       = Column(LargeBinary, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    contact             = relationship("Contact", back_populates="payments")
    bank_account        = relationship("BankAccount")
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class AdAccount(Base):
    """İzlenen Meta reklam hesabı — Parametreler ekranından yönetilir.
    Senkronizasyon aktif hesapları kullanır; pasifler atlanır."""
    __tablename__ = "ad_accounts"
    id                  = Column(Integer, primary_key=True, index=True)
    act_id              = Column(String(64), unique=True, nullable=False, index=True)  # "act_" önekli
    name                = Column(String(150), nullable=False)
    purpose             = Column(String(20), default="genel")  # wix_kayit | ig_dm | wa_dm | genel
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    created_by_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by          = relationship("User", foreign_keys=[created_by_user_id])

class AdSpend(Base):
    """Meta (Instagram/Facebook) reklam harcaması — hesap/gün/adset bazında.
    Hesap bilgisi (account_act_id/account_name/purpose) buraya denormalize edilir."""
    __tablename__ = "ad_spend"
    id              = Column(Integer, primary_key=True, index=True)
    account_act_id  = Column(String(64), nullable=False, index=True)   # "act_..." önekli Meta reklam hesabı id'si
    account_name    = Column(String(150), nullable=True)
    purpose         = Column(String(20), default="genel")             # wix_kayit | ig_dm | wa_dm | genel
    date            = Column(Date, nullable=False, index=True)         # time_increment=1 → bu satırın kapsadığı gün
    campaign_id     = Column(String(64), nullable=True)
    campaign_name   = Column(String(255), nullable=True)
    adset_id        = Column(String(80), nullable=True)
    adset_name      = Column(String(255), nullable=True)
    channel         = Column(String(20), default="other")             # instagram | whatsapp | facebook | other
    objective       = Column(String(50), nullable=True)
    spend           = Column(Numeric(12, 2), default=0)
    impressions     = Column(Integer, default=0)
    clicks          = Column(Integer, default=0)
    reach           = Column(Integer, default=0)
    results         = Column(Integer, default=0)                      # mesajlaşma konuşması VEYA link tıklaması
    result_type     = Column(String(40), nullable=True)              # messaging_conversation_started | link_click | manual
    currency        = Column(String(3), default="TRY")
    source          = Column(String(20), default="meta_sync")        # meta_sync | manual
    synced_at       = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("account_act_id", "date", "adset_id", name="uq_adspend_acct_date_adset"),
        Index("ix_adspend_acct_date", "account_act_id", "date"),
    )

class AdSyncState(Base):
    """Otomatik reklam senkronizasyonu + token durumu (tek satır)."""
    __tablename__ = "ad_sync_state"
    id                = Column(Integer, primary_key=True, index=True)
    last_run_at       = Column(DateTime, nullable=True)   # son BAŞARILI senkron
    last_status       = Column(String(20), nullable=True) # ok | error
    last_synced       = Column(Integer, default=0)
    last_message      = Column(Text, nullable=True)
    token_valid       = Column(Boolean, nullable=True)
    token_expires_at  = Column(DateTime, nullable=True)   # None = süresiz/bilinmiyor
    token_checked_at  = Column(DateTime, nullable=True)
    updated_at        = Column(DateTime, default=datetime.utcnow)

class Registration(Base):
    """Wix seminer kaydı — CSV ile yüklenir, e-posta/telefon ile kişiye eşleştirilir."""
    __tablename__ = "registrations"
    id                  = Column(Integer, primary_key=True, index=True)
    name                = Column(String(150), nullable=True)
    email               = Column(String(255), nullable=True, index=True)
    phone               = Column(String(32), nullable=True, index=True)
    seminar             = Column(String(255), nullable=True)
    registered_at       = Column(DateTime, nullable=True)
    source              = Column(String(20), default="wix_csv")
    source_channel      = Column(String(20), nullable=True)          # gelecek (Faz 3): kanal bazlı attribution
    matched_contact_id  = Column(Integer, ForeignKey("contacts.id"), nullable=True, index=True)
    dedup_key           = Column(String(80), nullable=True, unique=True, index=True)
    raw                 = Column(Text, nullable=True)                # orijinal CSV satırı (JSON)
    uploaded_at         = Column(DateTime, default=datetime.utcnow)
    matched_contact     = relationship("Contact", foreign_keys=[matched_contact_id])
