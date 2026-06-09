<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\DestinationRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\TripRepository;

/** Public (visitor-gated) destination reads, respecting the privacy filter. */
final class PublicDestinationController
{
    private AuthMiddleware $guard;
    private TripRepository $trips;
    private DestinationRepository $destinations;
    private SettingsRepository $settings;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->trips = new TripRepository();
        $this->destinations = new DestinationRepository();
        $this->settings = new SettingsRepository();
    }

    /** @param array<string,string> $params  (tripSlug) */
    public function forTrip(array $params): void
    {
        $this->guard->requireVisitor();
        $trip = $this->trips->findPublishedBySlug($params['tripSlug']);
        if ($trip === null) {
            Response::error('Trip not found.', 404);
            return;
        }
        $includePlanned = $this->settings->get('future_destinations_visible') === '1';
        Response::json(['destinations' => $this->destinations->forTripPublic((int) $trip['id'], $includePlanned)]);
    }

    /** @param array<string,string> $params  (slug) */
    public function show(array $params): void
    {
        $this->guard->requireVisitor();
        $includePlanned = $this->settings->get('future_destinations_visible') === '1';
        $destination = $this->destinations->findPublicBySlug($params['slug'], $includePlanned);
        if ($destination === null) {
            Response::error('Destination not found.', 404);
            return;
        }
        Response::json(['destination' => $destination]);
    }
}
