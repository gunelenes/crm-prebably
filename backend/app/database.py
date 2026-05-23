# from sqlalchemy import create_engine
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import sessionmaker
# from app.config import DATABASE_URL

# engine = create_engine(DATABASE_URL)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base = declarative_base()

# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set!")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+pg8000://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)
elif "psycopg2" in DATABASE_URL or "asyncpg" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split("://")[1]
    DATABASE_URL = "postgresql+pg8000://" + DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    pool_size=20,        # 5'ten 20'ye çıkar
    max_overflow=40,     # 10'dan 40'a çıkar
    pool_timeout=60,     # 30'dan 60'a çıkar
    pool_recycle=1800,   # Bağlantıları 30 dakikada bir yenile
    pool_pre_ping=True,  # Bağlantı sağlığını kontrol et
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()