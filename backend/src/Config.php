<?php

declare(strict_types=1);

namespace App;

/**
 * Tiny .env loader + config accessor. No external dependency.
 */
final class Config
{
    /** @var array<string,string> */
    private static array $values = [];

    public static function load(string $baseDir): void
    {
        $envFile = $baseDir . '/.env';
        if (!is_file($envFile)) {
            return;
        }

        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
            // strip inline comments and surrounding quotes/space
            $value = trim(preg_replace('/\s+#.*$/', '', $value) ?? $value);
            self::$values[trim($key)] = trim($value, " \t\"'");
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        if (array_key_exists($key, self::$values) && self::$values[$key] !== '') {
            return self::$values[$key];
        }
        $env = getenv($key);
        return $env !== false && $env !== '' ? $env : $default;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::get($key);
        if ($value === null) {
            return $default;
        }
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }
}
