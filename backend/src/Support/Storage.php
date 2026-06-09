<?php

declare(strict_types=1);

namespace App\Support;

use App\Config;
use RuntimeException;

/**
 * Uploaded-media storage. In production Apache serves /uploads directly; in dev
 * the PHP front controller serves it via serve() (see public/index.php).
 */
final class Storage
{
    public static function dir(): string
    {
        $configured = Config::get('UPLOADS_DIR');
        if (is_string($configured) && $configured !== '') {
            return rtrim($configured, '/');
        }
        // backend/src/Support -> repo root
        return dirname(__DIR__, 3) . '/uploads';
    }

    public static function ensureSubdir(string $relative): string
    {
        $abs = self::dir() . '/' . trim($relative, '/');
        if (!is_dir($abs) && !mkdir($abs, 0775, true) && !is_dir($abs)) {
            throw new RuntimeException('Cannot create storage directory: ' . $abs);
        }
        return $abs;
    }

    public static function absolute(string $relative): string
    {
        return self::dir() . '/' . ltrim($relative, '/');
    }

    public static function publicUrl(string $relative): string
    {
        return '/uploads/' . ltrim($relative, '/');
    }

    /** Safely stream a file under the uploads root (dev only; path-traversal guarded). */
    public static function serve(string $relative): void
    {
        $root = realpath(self::dir());
        $real = realpath(self::dir() . '/' . $relative);
        if ($root === false || $real === false || !str_starts_with($real, $root . DIRECTORY_SEPARATOR) || !is_file($real)) {
            http_response_code(404);
            header('Content-Type: text/plain');
            echo 'Not found';
            return;
        }
        $mime = match (strtolower(pathinfo($real, PATHINFO_EXTENSION))) {
            'webp' => 'image/webp',
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'avif' => 'image/avif',
            default => 'application/octet-stream',
        };
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($real);
    }
}
