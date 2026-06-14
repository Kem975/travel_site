<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Response;
use App\Middleware\AuthMiddleware;

/**
 * Admin-only place lookup. Proxies the Photon geocoder (OpenStreetMap data, free,
 * no API key) so the admin can search a city/address and auto-fill coordinates.
 * Server-side proxy keeps it first-party (no browser CORS dependency) and lets us
 * send a proper User-Agent. Returns a small, clean list — never raw Photon JSON.
 */
final class GeocodeController
{
    private const ENDPOINT = 'https://photon.komoot.io/api/';

    private AuthMiddleware $guard;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
    }

    public function search(): void
    {
        $this->guard->requireAdmin();

        $q = trim((string) ($_GET['q'] ?? ''));
        if (mb_strlen($q) < 2) {
            Response::json(['results' => []]);
            return;
        }

        $url = self::ENDPOINT . '?' . http_build_query(['q' => $q, 'limit' => 6, 'lang' => 'en']);
        $body = $this->fetch($url);
        $data = $body !== null ? json_decode($body, true) : null;
        $features = (is_array($data) && isset($data['features']) && is_array($data['features']))
            ? $data['features']
            : [];

        $results = [];
        $seen = [];
        foreach ($features as $feature) {
            $coords = $feature['geometry']['coordinates'] ?? null; // [lng, lat]
            $props = is_array($feature['properties'] ?? null) ? $feature['properties'] : [];
            if (!is_array($coords) || count($coords) < 2) {
                continue;
            }
            $label = self::label($props);
            if ($label === '' || isset($seen[$label])) {
                continue;
            }
            $seen[$label] = true;
            $results[] = [
                'label' => $label,
                'lat' => round((float) $coords[1], 6),
                'lng' => round((float) $coords[0], 6),
                'country' => self::str($props['country'] ?? ''),
            ];
        }

        Response::json(['results' => $results]);
    }

    /** Human label like "Lima, Peru" (falls back to state when there's no country). */
    private static function label(array $props): string
    {
        $name = self::str($props['name'] ?? '');
        $country = self::str($props['country'] ?? '');
        $tail = $country !== '' ? $country : self::str($props['state'] ?? '');
        if ($name === '') {
            $name = $tail;
        }
        if ($name === '') {
            return '';
        }
        return ($tail !== '' && $tail !== $name) ? "{$name}, {$tail}" : $name;
    }

    private static function str(mixed $value): string
    {
        return is_string($value) ? trim($value) : '';
    }

    /** Fetch a URL with a short timeout; cURL preferred, stream fallback. */
    private function fetch(string $url): ?string
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 6,
                CURLOPT_USERAGENT => 'OurJourney/1.0 (+https://voyage.kemen.fr)',
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
            ]);
            $body = curl_exec($ch);
            $ok = $body !== false && curl_getinfo($ch, CURLINFO_RESPONSE_CODE) < 400;
            return $ok ? (string) $body : null;
        }

        $context = stream_context_create(['http' => [
            'timeout' => 6,
            'header' => "User-Agent: OurJourney/1.0\r\nAccept: application/json\r\n",
        ]]);
        $body = @file_get_contents($url, false, $context);
        return $body !== false ? $body : null;
    }
}
