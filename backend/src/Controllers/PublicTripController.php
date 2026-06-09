<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\DestinationRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\TripRepository;

/** Public (visitor-gated) trip reads. Only published trips are exposed. */
final class PublicTripController
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

    public function index(): void
    {
        $this->guard->requireVisitor();
        Response::json(['trips' => $this->trips->allPublished()]);
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
        Response::json([
            'trip' => $trip,
            'destinations' => $this->destinations->forTripPublic((int) $trip['id'], $includePlanned),
        ]);
    }
}
