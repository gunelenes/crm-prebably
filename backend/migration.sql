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
-- 3) Sektör + Eğitim Seti parametre tabloları (2026-05 eklendi)
-- ============================================================================
-- 'sectors' ve 'training_sets' tabloları backend boot'unda create_all ile
-- otomatik oluşur. Burada sadece contacts'a FK kolonlarını ekliyoruz.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sector_id       INTEGER REFERENCES sectors(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS training_set_id INTEGER REFERENCES training_sets(id);

-- 'creatives' tablosu (kreatif parametreleri) backend boot'unda create_all ile
-- otomatik oluşur; burada contacts'a FK kolonunu ekliyoruz (2026-06 eklendi).
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS creative_id     INTEGER REFERENCES creatives(id);

-- ============================================================================
-- 4) Eski serbest metin sector / source_video verilerini taşı (opsiyonel)
-- ============================================================================
-- 4.1) Mevcut farklı değerleri gör:
--   SELECT DISTINCT sector       FROM contacts WHERE sector       IS NOT NULL AND sector       <> '';
--   SELECT DISTINCT source_video FROM contacts WHERE source_video IS NOT NULL AND source_video <> '';
--
-- 4.2) Çıkan listeyi UI'daki /parametreler ekranından Sektör/Eğitim Seti
--      olarak ekledikten sonra, isim eşleştirmesi ile FK'leri doldur:
--
--   UPDATE contacts c
--   SET sector_id = s.id
--   FROM sectors s
--   WHERE TRIM(LOWER(c.sector)) = TRIM(LOWER(s.name))
--     AND c.sector_id IS NULL;
--
--   UPDATE contacts c
--   SET training_set_id = t.id
--   FROM training_sets t
--   WHERE TRIM(LOWER(c.source_video)) = TRIM(LOWER(t.name))
--     AND c.training_set_id IS NULL;
--
-- 4.3) Migrate doğrulandıktan sonra eski string kolonları temizle (opsiyonel):
--   ALTER TABLE contacts DROP COLUMN IF EXISTS sector;
--   ALTER TABLE contacts DROP COLUMN IF EXISTS source_video;
--
-- ============================================================================
-- 5) Danışman FK kolonları (2026-05 — User dropdown'a geçiş)
-- ============================================================================
-- Eski serbest metin 'advisor' / 'assigned_to' alanları yerine User'a FK.

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS advisor_user_id     INTEGER REFERENCES users(id);
ALTER TABLE reminders     ADD COLUMN IF NOT EXISTS advisor_user_id     INTEGER REFERENCES users(id);
ALTER TABLE contacts      ADD COLUMN IF NOT EXISTS assigned_to_user_id INTEGER REFERENCES users(id);

-- Eski serbest metin verisini temizle (proje patlamasın, yeni alanlar NULL kalır,
-- kullanıcı UI'dan dropdown ile yeniden atayacak):
UPDATE activity_logs SET advisor     = NULL WHERE advisor     IS NOT NULL;
UPDATE reminders     SET advisor     = NULL WHERE advisor     IS NOT NULL;
UPDATE contacts      SET assigned_to = NULL WHERE assigned_to IS NOT NULL;

-- Opsiyonel: artık kullanılmayan string kolonları tamamen sil
-- (modelde duruyor ama backend hiç yazmıyor; istersen schema sadeleştir):
-- ALTER TABLE activity_logs DROP COLUMN IF EXISTS advisor;
-- ALTER TABLE reminders     DROP COLUMN IF EXISTS advisor;
-- ALTER TABLE contacts      DROP COLUMN IF EXISTS assigned_to;

-- ============================================================================
-- ROLLBACK (gerekirse):
--   ALTER TABLE statuses       DROP COLUMN created_by_user_id;
--   ALTER TABLE contacts       DROP COLUMN created_by_user_id,
--                              DROP COLUMN sector_id,
--                              DROP COLUMN training_set_id;
--   ALTER TABLE conversations  DROP COLUMN created_by_user_id, DROP COLUMN created_at;
--   ALTER TABLE messages       DROP COLUMN created_by_user_id;
--   ALTER TABLE activity_logs  DROP COLUMN created_by_user_id;
--   ALTER TABLE reminders      DROP COLUMN created_by_user_id;
--   ALTER TABLE quick_replies  DROP COLUMN created_by_user_id;
--   DROP TABLE users;
--   DROP TABLE sectors;
--   DROP TABLE training_sets;
-- ============================================================================
