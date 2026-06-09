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
}
