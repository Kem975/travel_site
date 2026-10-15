<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;

final class SettingsRepository
{
    public function get(string $key): ?string
    {
        $stmt = Database::connection()->prepare(
            'SELECT setting_value FROM site_settings WHERE setting_key = ?',
        );
        $stmt->execute([$key]);
        $value = $stmt->fetchColumn();
        return is_string($value) ? $value : null;
    }

    public function set(string $key, ?string $value): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        );
        $stmt->execute([$key, $value]);
    }

    /**
     * Where the journey started — the globe's opening view and the point its
     * rotation runs from. Stored as three keys; parsed in one place so every
     * caller agrees on what a usable departure point is.
     *
     * Coordinates missing or unreadable means there is no departure point at all,
     * not one at 0,0 off the coast of Africa — callers fall back to a world view.
     *
     * @return array{name:string,lat:float,lng:float}|null
     */
    public function departure(): ?array
    {
        $lat = $this->get('departure_lat');
        $lng = $this->get('departure_lng');
        if ($lat === null || $lng === null || !is_numeric($lat) || !is_numeric($lng)) {
            return null;
        }
        return [
            'name' => (string) ($this->get('departure_name') ?? ''),
            'lat' => (float) $lat,
            'lng' => (float) $lng,
        ];
    }

    /**
     * The clock home runs on, as an IANA identifier — what admin timestamps are
     * rendered in, wherever in the world they are being read from.
     *
     * Null when unset or no longer a zone this PHP knows, so callers fall back to
     * the reader's own clock rather than throwing on a name the tzdata dropped.
     */
    public function departureTimezone(): ?string
    {
        $tz = $this->get('departure_timezone');
        if ($tz === null || $tz === '' || !in_array($tz, \DateTimeZone::listIdentifiers(), true)) {
            return null;
        }
        return $tz;
    }
}
