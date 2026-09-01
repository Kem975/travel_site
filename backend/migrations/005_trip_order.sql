-- 005_trip_order.sql — explicit route order for trips (the site's "pays" chapters).
-- Dates alone can't order the route: the later countries are booked without firm
-- dates, so they'd all collapse to the same position.

SET NAMES utf8mb4;

ALTER TABLE trips ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER visibility;

-- Seed from the previous implicit ordering so existing rows keep their sequence.
UPDATE trips t
JOIN (
    SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(start_date, created_at) ASC, id ASC) - 1 AS rn
    FROM trips
) ordered ON ordered.id = t.id
SET t.sort_order = ordered.rn;
