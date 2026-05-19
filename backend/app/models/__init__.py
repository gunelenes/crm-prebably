from app.database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

class Contact(Base):
    __tablename__ = "contacts"
    id          = Column(Integer, primary_key=True, index=True)
    platform    = Column(String(20))
    external_id = Column(String(500), unique=True)
    name        = Column(String(100))
    phone       = Column(String(20), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    conversations = relationship("Conversation", back_populates="contact")

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

class QuickReply(Base):
    __tablename__ = "quick_replies"
    id         = Column(Integer, primary_key=True, index=True)
    title      = Column(String(100))
    content    = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)