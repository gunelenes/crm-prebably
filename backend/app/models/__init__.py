from app.database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime

class Status(Base):
    __tablename__ = "statuses"
    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(100))
    color      = Column(String(20), default="#6B7280")
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Contact(Base):
    __tablename__ = "contacts"
    id                    = Column(Integer, primary_key=True, index=True)
    platform              = Column(String(20))
    external_id           = Column(String(500), unique=True)
    name                  = Column(String(100))
    full_name             = Column(String(100), nullable=True)
    phone                 = Column(String(20), nullable=True)
    sector                = Column(String(100), nullable=True)
    description           = Column(Text, nullable=True)
    knows_us              = Column(Boolean, default=False)
    previous_trainings    = Column(Text, nullable=True)
    source_video          = Column(String(200), nullable=True)
    purchase_potential = Column(Enum('düşük', 'orta', 'yüksek', name='purchase_potential_enum'), nullable=True)
    had_training          = Column(Boolean, default=False)
    purchased             = Column(Boolean, default=False)
    reason_not_purchased  = Column(Text, nullable=True)
    assigned_to           = Column(String(100), nullable=True)
    status_id             = Column(Integer, ForeignKey("statuses.id"), nullable=True)
    created_at            = Column(DateTime, default=datetime.utcnow)
    status                = relationship("Status")
    conversations         = relationship("Conversation", back_populates="contact")
    activity_logs         = relationship("ActivityLog", back_populates="contact")
    reminders             = relationship("Reminder", back_populates="contact")

class Conversation(Base):
    __tablename__ = "conversations"
    id              = Column(Integer, primary_key=True, index=True)
    contact_id      = Column(Integer, ForeignKey("contacts.id"))
    platform        = Column(String(20))
    unread_count    = Column(Integer, default=0)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    contact         = relationship("Contact", back_populates="conversations")
    messages        = relationship("Message", back_populates="conversation")

class Message(Base):
    __tablename__ = "messages"
    id              = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    direction       = Column(String(10))
    content         = Column(Text)
    message_type    = Column(String(20), default="text")
    platform        = Column(String(20))
    external_id     = Column(String(500), nullable=True)
    is_read         = Column(Boolean, default=False)
    timestamp       = Column(DateTime, default=datetime.utcnow)
    conversation    = relationship("Conversation", back_populates="messages")

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id             = Column(Integer, primary_key=True, index=True)
    contact_id     = Column(Integer, ForeignKey("contacts.id"))
    type           = Column(String(50))
    title          = Column(String(200))
    description    = Column(Text, nullable=True)
    old_status_id  = Column(Integer, nullable=True)
    new_status_id  = Column(Integer, nullable=True)
    advisor        = Column(String(100), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    contact        = relationship("Contact", back_populates="activity_logs")

class Reminder(Base):
    __tablename__ = "reminders"
    id          = Column(Integer, primary_key=True, index=True)
    contact_id  = Column(Integer, ForeignKey("contacts.id"))
    title       = Column(String(200))
    description = Column(Text, nullable=True)
    remind_at   = Column(DateTime)
    is_done     = Column(Boolean, default=False)
    advisor     = Column(String(100), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    contact     = relationship("Contact", back_populates="reminders")

class QuickReply(Base):
    __tablename__ = "quick_replies"
    id         = Column(Integer, primary_key=True, index=True)
    title      = Column(String(100))
    content    = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)