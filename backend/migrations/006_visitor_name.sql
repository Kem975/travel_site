-- 006_visitor_name.sql — let a visitor say who they are.
-- The gate password is shared, so sessions are the only place a visitor identity
-- can live. Self-declared and optional: it answers "is anyone reading?", it is
-- not an authentication factor.

SET NAMES utf8mb4;

ALTER TABLE sessions ADD COLUMN visitor_name VARCHAR(60) NULL AFTER user_id;
