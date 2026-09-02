<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\ArticleRepository;
use App\Repositories\DestinationRepository;
use App\Repositories\PhotoRepository;
use App\Repositories\RecipeRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\TripRepository;
use App\Services\ArticleBlocks;
use App\Support\PhotoPresenter;

/**
 * Public destination-article reading (visitor-gated). Resolves photo IDs and prev/next.
 *
 * The requested language is answered with that version or with nothing at all —
 * never with a silent fall back to French. A reader who asked for English and got
 * French without being told would think that *is* the English version; the page
 * says the translation is missing and offers the original instead.
 */
final class PublicArticleController
{
    private AuthMiddleware $guard;
    private DestinationRepository $destinations;
    private TripRepository $trips;
    private ArticleRepository $articles;
    private PhotoRepository $photos;
    private RecipeRepository $recipes;
    private SettingsRepository $settings;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->destinations = new DestinationRepository();
        $this->trips = new TripRepository();
        $this->articles = new ArticleRepository();
        $this->photos = new PhotoRepository();
        $this->recipes = new RecipeRepository();
        $this->settings = new SettingsRepository();
    }

    /** @param array<string,string> $params  (destination slug) */
    public function show(array $params): void
    {
        $this->guard->requireVisitor();
        $includePlanned = $this->settings->get('future_destinations_visible') === '1';

        $destination = $this->destinations->findPublicBySlug($params['slug'], $includePlanned);
        if ($destination === null) {
            Response::error('Destination not found.', 404);
            return;
        }
        $lang = ArticleRepository::lang($_GET['lang'] ?? null);
        $available = $this->articles->publishedLangs((int) $destination['id']);
        if ($available === []) {
            Response::error('Article not found.', 404);
            return;
        }

        // Missing in the requested language but readable in another: 200 with a null
        // article, so the page can name the language and link to the one that exists.
        $article = in_array($lang, $available, true)
            ? $this->articles->findPublishedByDestinationId((int) $destination['id'], $lang)
            : null;

        $blocks = $article !== null ? $this->articles->blocks((int) $article['id']) : [];
        $photos = [];
        foreach (ArticleBlocks::referencedPhotoIds($blocks) as $photoId) {
            $photo = $this->photos->find($photoId);
            if ($photo !== null) {
                $photos[(string) $photoId] = PhotoPresenter::present($photo);
            }
        }

        $trip = $this->trips->find((int) $destination['trip_id']);
        [$prev, $next] = $this->neighbours((int) $destination['trip_id'], (int) $destination['id'], $includePlanned);

        Response::json([
            'destination' => [
                'id' => (int) $destination['id'],
                'title' => $destination['title'],
                'slug' => $destination['slug'],
                'country' => $destination['country'],
                'arrival_date' => $destination['arrival_date'],
                'departure_date' => $destination['departure_date'],
                'excerpt' => $destination['excerpt'],
                'cover' => $this->presentPhoto($destination['cover_photo_id']),
            ],
            'trip' => $trip !== null ? ['title' => $trip['title'], 'slug' => $trip['slug']] : null,
            'lang' => $lang,
            'available_langs' => $available,
            // Recipes pinned to this stop, in the language being read — an
            // untranslated one is simply absent rather than listed in French.
            'recipes' => array_map(
                static fn (array $row): array => ['slug' => $row['slug'], 'title' => $row['title']],
                $this->recipes->publishedForDestination((int) $destination['id'], $lang),
            ),
            'article' => $article === null ? null : [
                'title' => $article['title'],
                'subtitle' => $article['subtitle'],
                'published_at' => $article['published_at'],
            ],
            'blocks' => $blocks,
            'photos' => (object) $photos,
            'prev' => $prev,
            'next' => $next,
        ]);
    }

    /**
     * @return array{0:array{slug:string,title:string}|null,1:array{slug:string,title:string}|null}
     */
    private function neighbours(int $tripId, int $destinationId, bool $includePlanned): array
    {
        $list = $this->destinations->forTripPublic($tripId, $includePlanned);
        $index = null;
        foreach ($list as $i => $row) {
            if ((int) $row['id'] === $destinationId) {
                $index = $i;
                break;
            }
        }
        if ($index === null) {
            return [null, null];
        }
        $pick = static fn (?array $row): ?array => $row === null ? null : ['slug' => $row['slug'], 'title' => $row['title']];
        return [$pick($list[$index - 1] ?? null), $pick($list[$index + 1] ?? null)];
    }

    /** @return array<string,mixed>|null */
    private function presentPhoto(mixed $photoId): ?array
    {
        if ($photoId === null) {
            return null;
        }
        $photo = $this->photos->find((int) $photoId);
        return $photo !== null ? PhotoPresenter::present($photo) : null;
    }
}
