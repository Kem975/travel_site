<?php

declare(strict_types=1);

namespace App\Security;

final class Tokens
{
    /** A 256-bit random session token (the raw value lives only in the cookie). */
    public static function random(): string
    {
        return bin2hex(random_bytes(32));
    }

    /** Only the hash is stored in the DB, so a DB leak can't resurrect sessions. */
    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
