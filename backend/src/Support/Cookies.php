<?php

declare(strict_types=1);

namespace App\Support;

use App\Config;

final class Cookies
{
    public const SESSION = 'oj_session';

    public static function setSession(string $token, int $days): void
    {
        setcookie(self::SESSION, $token, self::options(time() + $days * 86400));
    }

    public static function clearSession(): void
    {
        setcookie(self::SESSION, '', self::options(time() - 3600));
    }

    /** @return array{expires:int,path:string,httponly:bool,secure:bool,samesite:string} */
    private static function options(int $expires): array
    {
        return [
            'expires' => $expires,
            'path' => '/',
            'httponly' => true,                          // JS cannot read the session token
            'secure' => Config::bool('COOKIE_SECURE', false), // true in production (HTTPS)
            'samesite' => 'Lax',                         // blocks cross-site POSTs (CSRF defense-in-depth)
        ];
    }
}
