<?php

declare(strict_types=1);

namespace App\Security;

use App\Config;

/**
 * Synchronizer-token CSRF, derived from the session via HMAC(APP_KEY).
 * The client reads it from /api/auth/session and echoes it in X-CSRF-Token on
 * mutations; an attacker can't compute it (no APP_KEY, no HttpOnly cookie).
 */
final class Csrf
{
    public static function tokenFor(string $sessionTokenHash): string
    {
        return hash_hmac('sha256', $sessionTokenHash, self::key());
    }

    public static function check(string $provided, string $sessionTokenHash): bool
    {
        return $provided !== '' && hash_equals(self::tokenFor($sessionTokenHash), $provided);
    }

    private static function key(): string
    {
        $key = Config::get('APP_KEY');
        return is_string($key) && $key !== '' ? $key : 'insecure-dev-key-set-APP_KEY';
    }
}
