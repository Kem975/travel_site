<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\DestinationRepository;
use App\Repositories\PhotoRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\TripRepository;
use App\Support\PhotoPresenter;
use DateTimeImmutable;

/** Public (visitor-gated) trip reads. Only published trips are exposed. */
final class PublicTripController
{
    private AuthMiddleware $guard;
    private TripRepository $trips;
    private DestinationRepository $destinations;
    private PhotoRepository $photos;
    private SettingsRepository $settings;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->trips = new TripRepository();
        $this->destinations = new DestinationRepository();
        $this->photos = new PhotoRepository();
        $this->settings = new SettingsRepository();
    }

    public function index(): void
    {
        $this->guard->requireVisitor();
        $trips = array_map(
            fn (array $t): array => $t + ['cover' => $this->cover($t['cover_photo_id'])],
            $this->trips->allPublished(),
        );
        Response::json(['trips' => $trips]);
    }

    /** @param array<string,string> $params */
    public function show(array $params): void
    {
        $this->guard->requireVisitor();
        $trip = $this->trips->findPublishedBySlug($params['slug']);
        if ($trip === null) {
            Response::error('Trip not found.', 404);
            return;
        }
        $includePlanned = $this->settings->get('future_destinations_visible') === '1';
        $destinations = $this->destinations->forTripPublic((int) $trip['id'], $includePlanned);

        Response::json([
            'trip' => $trip + ['cover' => $this->cover($trip['cover_photo_id'])],
            'destinations' => array_map(
                fn (array $d): array => $d + ['cover' => $this->cover($d['cover_photo_id'])],
                $destinations,
            ),
            'stats' => [
                'destinations' => count($destinations),
                'days' => $this->days($trip['start_date'], $trip['end_date']),
                'photos' => $this->photos->countPublicForTrip((int) $trip['id'], $includePlanned),
            ],
        ]);
    }

    /** @return array<string,mixed>|null */
    private function cover(mixed $photoId): ?array
    {
        if ($photoId === null) {
            return null;
        }
        $photo = $this->photos->find((int) $photoId);
        return $photo !== null ? PhotoPresenter::present($photo) : null;
    }

    private function days(mixed $start, mixed $end): ?int
    {
        if (!is_string($start) || !is_string($end) || $start === '' || $end === '') {
            return null;
        }
        $from = DateTimeImmutable::createFromFormat('Y-m-d', $start);
        $to = DateTimeImmutable::createFromFormat('Y-m-d', $end);
        if ($from === false || $to === false) {
            return null;
        }
        return (int) $from->diff($to)->days + 1;
    }
}
