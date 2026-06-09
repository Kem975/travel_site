-- 003_photos.sql — media pipeline support.
-- `variants` records which WebP widths were generated (so srcset is built without
-- probing the filesystem); `updated_at` for metadata edits.

SET NAMES utf8mb4;

ALTER TABLE photos
    ADD COLUMN variants   JSON NULL AFTER height,
    ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
