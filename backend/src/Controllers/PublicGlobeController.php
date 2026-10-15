<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\ArticleRepository;
use App\Repositories\DestinationRepository;
use App\Repositories\PhotoRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\TripRepository;
use App\Support\PhotoPresenter;

/** Globe data: published trips with their visible destinations in route order. */
final class PublicGlobeController
{
    private AuthMiddleware $guard;
    private TripRepository $trips;
    private DestinationRepository $destinations;
    private ArticleRepository $articles;
    private PhotoRepository $photos;
    private SettingsRepository $settings;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->trips = new TripRepository();
        $this->destinations = new DestinationRepository();
        $this->articles = new ArticleRepository();
        $this->photos = new PhotoRepository();
        $this->settings = new SettingsRepository();
    }

    public function index(): void
    {
        $this->guard->requireVisitor();
        $includePlanned = $this->settings->get('future_destinations_visible') === '1';
        $hasArticle = array_flip($this->articles->publishedDestinationIds());

        $trips = [];
        foreach ($this->trips->allPublished() as $trip) {
            $places = [];
            // forTripPublic is ordered by sort_order → this is the route order.
            foreach ($this->destinations->forTripPublic((int) $trip['id'], $includePlanned) as $d) {
                $cover = $this->cover($d['cover_photo_id']);
                $places[] = [
                    'id' => (int) $d['id'],
                    'slug' => $d['slug'],
                    'trip_slug' => $trip['slug'],
                    'title' => $d['title'],
                    'country' => $d['country'],
                    'lat' => $d['latitude'] !== null ? (float) $d['latitude'] : null,
                    'lng' => $d['longitude'] !== null ? (float) $d['longitude'] : null,
                    'status' => $d['status'],
                    'arrival_date' => $d['arrival_date'],
                    'departure_date' => $d['departure_date'],
                    'has_article' => isset($hasArticle[(int) $d['id']]),
                    'cover_thumb' => $cover['thumb'] ?? null,
                ];
            }
            $trips[] = ['slug' => $trip['slug'], 'title' => $trip['title'], 'places' => $places];
        }

        // The stop to show on arrival. Sent as an id, not a second copy of the
        // place: it is already in `trips`, and duplicating it would let the card
        // and the marker drift apart. Withheld unless that stop actually made it
        // into the payload, so privacy filtering can never be undone by the card
        // naming a stop the rest of the globe is hiding.
        $latest = $this->articles->latestPublishedDestinationId();
        $visible = [];
        foreach ($trips as $trip) {
            foreach ($trip['places'] as $place) {
                $visible[(int) $place['id']] = true;
            }
        }

        // Where we left from — the globe's opening view. Not a destination and not
        // part of the route, so it is sent alongside the trips rather than inside them.
        Response::json([
            'trips' => $trips,
            'departure' => $this->settings->departure(),
            'latest_destination_id' => $latest !== null && isset($visible[$latest]) ? $latest : null,
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
}
