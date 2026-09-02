-- 007_article_lang.sql — one article per destination *per language*.
-- The blocks already hang off article_id, so each language gets its own block
-- list: a translation is free to use different photos, or a shorter cut, rather
-- than being forced to mirror the French layout block for block.

SET NAMES utf8mb4;

-- Everything written so far is the French version.
ALTER TABLE articles ADD COLUMN lang CHAR(2) NOT NULL DEFAULT 'fr' AFTER destination_id;

-- The new key first, the old one after: fk_articles_destination needs an index on
-- destination_id at all times, and MySQL refuses to drop the last one that covers
-- it. The composite key leads with destination_id, so it can take over the job.
ALTER TABLE articles ADD UNIQUE KEY uq_articles_destination_lang (destination_id, lang);
ALTER TABLE articles DROP INDEX uq_articles_destination;
