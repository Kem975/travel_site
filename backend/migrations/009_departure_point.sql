-- 009_departure_point.sql — where the journey is measured from.
--
-- The globe used to open on a hardcoded world view with no relation to the trip.
-- It now opens on the place we left from, and the rotation starts there.
--
-- This is *not* a destination: Saint-Pierre-et-Miquelon is home, not a stop on a
-- route that runs through South America and Asia, so it must not appear in the
-- journal, the gallery or the route line. Hence a setting rather than a row in
-- destinations.
--
-- Three keys rather than one JSON blob, so each is independently validatable and
-- readable straight from phpMyAdmin on the host.

SET NAMES utf8mb4;

-- `setting_value = setting_value` on conflict: re-running this must never
-- overwrite coordinates changed since from the admin.
INSERT INTO site_settings (setting_key, setting_value) VALUES
    ('departure_name', 'Saint-Pierre-et-Miquelon'),
    ('departure_lat', '46.7819'),
    ('departure_lng', '-56.1769')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
