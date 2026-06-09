<?php

declare(strict_types=1);

namespace App\Security;

use App\Config;
use App\Database;

/**
 * DB-backed login throttle (portable to shared hosting). Counts failed attempts
 * per hashed IP + scope within a window. Applies to the visitor password and
 * admin login (plan §15.7).
 */
final class RateLimiter
{
    private const WINDOW_MINUTES = 15;
    private const MAX_FAILURES = 10;

    public static function ipHash(string $ip): string
    {
        return hash_hmac('sha256', $ip, Config::get('APP_KEY') ?? '');
    }

    /** @return bool true if the attempt is allowed, false if throttled */
    public static function allow(string $ipHash, string $scope): bool
    {
        // WINDOW_MINUTES is a trusted int constant; NOW() keeps insert/compare on one clock.
        $sql = sprintf(
            'SELECT COUNT(*) FROM login_attempts
             WHERE ip_hash = ? AND scope = ? AND success = 0
             AND created_at > (NOW() - INTERVAL %d MINUTE)',
            self::WINDOW_MINUTES,
        );
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute([$ipHash, $scope]);
        return (int) $stmt->fetchColumn() < self::MAX_FAILURES;
    }

    public static function record(string $ipHash, string $scope, bool $success): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO login_attempts (ip_hash, scope, success) VALUES (?, ?, ?)',
        );
        $stmt->execute([$ipHash, $scope, $success ? 1 : 0]);
    }
}
