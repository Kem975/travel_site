<?php

declare(strict_types=1);

namespace App\Security;

use App\Config;

/**
 * Stateless, HMAC-signed timestamp token for the minimum-fill-time check on the
 * comment form. The issue time is signed, so a bot can't backdate it to bypass
 * the delay, and no server-side state is needed.
 */
final class FormToken
{
    public static function issue(): string
    {
        $ts = time();
        return $ts . '.' . self::sign($ts);
    }

    public static function valid(string $token, int $minSeconds, int $maxSeconds): bool
    {
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2 || !ctype_digit($parts[0])) {
            return false;
        }
        $ts = (int) $parts[0];
        if (!hash_equals(self::sign($ts), $parts[1])) {
            return false;
        }
        $elapsed = time() - $ts;
        return $elapsed >= $minSeconds && $elapsed <= $maxSeconds;
    }

    private static function sign(int $ts): string
    {
        return hash_hmac('sha256', 'comment-form:' . $ts, Config::get('APP_KEY') ?? '');
    }
}
