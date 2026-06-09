-- 004_article_version.sql — optimistic concurrency for the block editor.
-- An integer version (not second-precision updated_at) so two saves within the
-- same second still conflict reliably.

SET NAMES utf8mb4;

ALTER TABLE articles ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER status;
