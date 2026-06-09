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

/** Chronological journal across published trips (plan §6.2) — the non-globe way to read. */
final class PublicJournalController
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

        $entries = [];
        foreach ($this->trips->allPublished() as $trip) {
            foreach ($this->destinations->forTripPublic((int) $trip['id'], $includePlanned) as $d) {
                $entries[] = [
                    'id' => (int) $d['id'],
                    'slug' => $d['slug'],
                    'trip_slug' => $trip['slug'],
                    'trip_title' => $trip['title'],
                    'title' => $d['title'],
                    'country' => $d['country'],
                    'arrival_date' => $d['arrival_date'],
                    'departure_date' => $d['departure_date'],
                    'excerpt' => $d['excerpt'],
                    'status' => $d['status'],
                    'sort_order' => (int) $d['sort_order'],
                    'cover' => $this->cover($d['cover_photo_id']),
                    'has_article' => isset($hasArticle[(int) $d['id']]),
                ];
            }
        }

        // Chronological by arrival date (undated last), then route order.
        usort($entries, static function (array $a, array $b): int {
            $da = $a['arrival_date'] ?? '9999-99-99';
            $db = $b['arrival_date'] ?? '9999-99-99';
            return $da <=> $db ?: ($a['sort_order'] <=> $b['sort_order']);
        });

        Response::json(['entries' => $entries]);
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
