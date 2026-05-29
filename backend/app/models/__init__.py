from app.database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum, Numeric, LargeBinary
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
