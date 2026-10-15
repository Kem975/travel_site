<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\SettingsRepository;
use App\Validation\Validator;

/**
 * Site settings the admin can edit.
 *
 * site_settings has always been read from seven controllers but written by nobody
 * — the values were whatever the seed migration left. This is the first surface
 * that writes them, so it is deliberately narrow: only the keys listed here can be
 * set, and `trip_password_hash` is not one of them (that stays with
 * `console.php visitor:set-password`, which hashes it).
 */
final class SettingsController
{
    /** Keys this endpoint may read and write. Anything else is ignored outright. */
    private const EDITABLE = ['departure_name', 'departure_lat', 'departure_lng', 'departure_timezone'];

    private AuthMiddleware $guard;
    private SettingsRepository $settings;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->settings = new SettingsRepository();
    }

    public function show(): void
    {
        $this->guard->requireAdmin();

        $out = [];
        foreach (self::EDITABLE as $key) {
            $out[$key] = $this->settings->get($key);
        }
        Response::json(['settings' => $out]);
    }

    public function update(): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $data = Request::json();
        if (($errors = $this->validate($data)) !== null) {
            Response::json(['errors' => $errors], 422);
            return;
        }

        // A blank name is allowed (the point still works unnamed), but blank
        // coordinates mean "no departure point" and are stored as NULL rather than
        // as the empty string, so SettingsRepository::departure() rejects them.
        $name = trim((string) ($data['departure_name'] ?? ''));
        $lat = trim((string) ($data['departure_lat'] ?? ''));
        $lng = trim((string) ($data['departure_lng'] ?? ''));

        $this->settings->set('departure_name', $name);
        $this->settings->set('departure_lat', $lat === '' ? null : $lat);
        $this->settings->set('departure_lng', $lng === '' ? null : $lng);
        $this->settings->set('departure_timezone', trim((string) ($data['departure_timezone'] ?? '')));

        $this->show();
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,string>|null
     */
    private function validate(array $data): ?array
    {
        $v = new Validator($data);
        $v->stringMax('departure_name', 120)
            ->floatRange('departure_lat', -90, 90)
            ->floatRange('departure_lng', -180, 180);

        $errors = $v->fails() ? $v->errors() : [];

        // Half a coordinate pair is not a point. floatRange passes on an empty
        // value, so this is the check that catches a lone latitude. Phrased as a
        // full sentence because Validator's own prefixing does not apply here.
        $lat = trim((string) ($data['departure_lat'] ?? ''));
        $lng = trim((string) ($data['departure_lng'] ?? ''));
        if (($lat === '') !== ($lng === '')) {
            $errors['departure_lat'] ??= 'Latitude and longitude must be set together.';
        }

        // Checked against this PHP's tzdata rather than a regex: a plausible-looking
        // name that DateTimeZone cannot resolve would break every timestamp on the
        // dashboard, and the client would fail the same way on Intl.
        $tz = trim((string) ($data['departure_timezone'] ?? ''));
        if ($tz !== '' && !in_array($tz, \DateTimeZone::listIdentifiers(), true)) {
            $errors['departure_timezone'] ??= 'Departure timezone is not a known time zone.';
        }

        return $errors === [] ? null : $errors;
    }
}
