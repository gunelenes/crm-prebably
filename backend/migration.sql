-- ============================================================================
-- CRM Auth + Audit Migration
-- ============================================================================
-- Bu SQL'i Railway Postgres konsolundan (veya psql ile) bir kez çalıştır.
-- "users" tablosu uygulama açılırken create_all ile otomatik oluşacak;
-- bu dosya MEVCUT tablolara created_by_user_id ve eksik created_at kolonlarını ekler.
--
-- ÖNCESİ:
--   1. Backend deploy edilmiş ve users tablosu oluşmuş olmalı
--      (uygulama bir kez başlatılır başlatılmaz Base.metadata.create_all User'ı yaratır).
--   2. JWT_SECRET env var Railway'de set edilmiş olmalı:
--        openssl rand -hex 32   (üretilen değeri Railway env'e koy)
--
-- ============================================================================

-- 1) Mevcut tablolara created_by_user_id kolonu ekle (NULL'a izinli; eski satırlar NULL kalır)
ALTER TABLE statuses       ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE contacts       ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE conversations  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE conversations  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE messages       ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE activity_logs  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE reminders      ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE quick_replies  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);

-- 2) İlk admin kullanıcısını ekle
--    bcrypt hash'i lokal Python ile üret:
--      python -c "import bcrypt; print(bcrypt.hashpw(b'PAROLAN_BURAYA', bcrypt.gensalt()).decode())"
--    Çıkan '$2b$12$...' hash'i aşağıdaki <BCRYPT_HASH> yerine yapıştır:
--
-- INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
-- VALUES ('admin', '<BCRYPT_HASH>', 'Admin', 'admin', true, NOW());
--
-- ============================================================================
-- ROLLBACK (gerekirse):
--   ALTER TABLE statuses       DROP COLUMN created_by_user_id;
--   ALTER TABLE contacts       DROP COLUMN created_by_user_id;
--   ALTER TABLE conversations  DROP COLUMN created_by_user_id, DROP COLUMN created_at;
--   ALTER TABLE messages       DROP COLUMN created_by_user_id;
--   ALTER TABLE activity_logs  DROP COLUMN created_by_user_id;
--   ALTER TABLE reminders      DROP COLUMN created_by_user_id;
--   ALTER TABLE quick_replies  DROP COLUMN created_by_user_id;
--   DROP TABLE users;
-- ============================================================================
