<?php

declare(strict_types=1);

namespace App\Http;

final class Request
{
    /** @return array<string,mixed> */
    public static function json(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public static function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        $value = $_SERVER[$key] ?? null;
        return is_string($value) ? $value : null;
    }

    public static function cookie(string $name): ?string
    {
        $value = $_COOKIE[$name] ?? null;
        return is_string($value) ? $value : null;
    }

    public static function clientIp(): string
    {
        // Behind a proxy/CDN (e.g. Cloudflare on OVH) prefer a trusted forwarded
        // header instead — but only if you trust the proxy. REMOTE_ADDR is safe by default.
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        return is_string($ip) ? $ip : '0.0.0.0';
    }
}
