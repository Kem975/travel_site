<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\DestinationRepository;

/**
 * The route travelled so far, as a flat list of stops for the navbar timeline.
 *
 * Planned stops are left out entirely: the timeline reads as a record of the journey,
 * not an itinerary, so it always ends on where we are now.
 */
final class PublicJourneyController
{
    private AuthMiddleware $guard;
    private DestinationRepository $destinations;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->destinations = new DestinationRepository();
    }

    public function timeline(): void
    {
        $this->guard->requireVisitor();

        $stops = [];
        foreach ($this->destinations->publicRoute(false) as $stop) {
            $stops[] = [
                'title' => $stop['title'],
                'state' => $stop['status'] === 'current' ? 'current' : 'visited',
                'slug' => $stop['slug'],
                'trip_slug' => $stop['trip_slug'],
            ];
        }

        Response::json(['stops' => $stops]);
    }
}
