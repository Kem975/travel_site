-- 010_departure_timezone.sql — the clock the connection log is read in.
--
-- The admin dashboard used to render session times with `new Date(...)` on a bare
-- MySQL DATETIME, which the browser reads as *its own* local time. That was only
-- ever right by accident, and it stops being right the moment we are reading the
-- site from Lima or Hanoi: the same row would show a different hour in every
-- airport.
--
-- So the log is pinned to one clock — home's. It sits beside the departure point
-- because it is the same fact: where we are from. An IANA identifier, not an
-- offset, so DST is applied per date rather than frozen at today's -02:00.

SET NAMES utf8mb4;

INSERT INTO site_settings (setting_key, setting_value) VALUES
    ('departure_timezone', 'America/Miquelon')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
