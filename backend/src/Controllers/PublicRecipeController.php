<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\PhotoRepository;
use App\Repositories\RecipeRepository;
use App\Repositories\TripRepository;
use App\Services\ArticleBlocks;
use App\Support\PhotoPresenter;

/**
 * Public recipe reading (visitor-gated).
 *
 * The list only ever holds recipes published in the language asked for — an
 * untranslated recipe is absent rather than shown in the wrong language. A recipe
 * reached by its own URL answers like an article does: the requested language or
 * a null body naming the ones that exist, never a silent fall back.
 */
final class PublicRecipeController
{
    private AuthMiddleware $guard;
    private RecipeRepository $recipes;
    private TripRepository $trips;
    private PhotoRepository $photos;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->recipes = new RecipeRepository();
        $this->trips = new TripRepository();
        $this->photos = new PhotoRepository();
    }

    public function index(): void
    {
        $this->guard->requireVisitor();
        $lang = RecipeRepository::lang($_GET['lang'] ?? null);

        $recipes = array_map(fn (array $row): array => [
            'slug' => $row['slug'],
            'title' => $row['title'],
            'subtitle' => $row['subtitle'],
            'trip_title' => $row['trip_title'],
            'trip_slug' => $row['trip_slug'],
            'cover' => $this->presentPhoto($row['cover_photo_id']),
        ], $this->recipes->published($lang));

        Response::json(['recipes' => $recipes, 'lang' => $lang]);
    }

    /** @param array<string,string> $params  (recipe slug) */
    public function show(array $params): void
    {
        $this->guard->requireVisitor();

        $recipe = $this->recipes->findBySlug($params['slug']);
        if ($recipe === null) {
            Response::error('Recipe not found.', 404);
            return;
        }
        $trip = $this->trips->find((int) $recipe['trip_id']);
        if ($trip === null || $trip['status'] !== 'published') {
            Response::error('Recipe not found.', 404);
            return;
        }

        $lang = RecipeRepository::lang($_GET['lang'] ?? null);
        $available = $this->recipes->publishedLangs((int) $recipe['id']);
        if ($available === []) {
            Response::error('Recipe not found.', 404);
            return;
        }

        $translation = in_array($lang, $available, true)
            ? $this->recipes->translation((int) $recipe['id'], $lang)
            : null;
        $blocks = $translation !== null ? $this->recipes->blocks((int) $translation['translation_id']) : [];

        $photos = [];
        foreach (ArticleBlocks::referencedPhotoIds($blocks) as $photoId) {
            $photo = $this->photos->find($photoId);
            if ($photo !== null) {
                $photos[(string) $photoId] = PhotoPresenter::present($photo);
            }
        }

        Response::json([
            'recipe' => [
                'slug' => $recipe['slug'],
                'cover' => $this->presentPhoto($recipe['cover_photo_id']),
            ],
            'trip' => ['title' => $trip['title'], 'slug' => $trip['slug']],
            'lang' => $lang,
            'available_langs' => $available,
            'translation' => $translation === null ? null : [
                'title' => $translation['title'],
                'subtitle' => $translation['subtitle'],
                'ingredients' => json_decode((string) $translation['ingredients'], true) ?: [],
                'steps' => json_decode((string) $translation['steps'], true) ?: [],
            ],
            'blocks' => $blocks,
            'photos' => (object) $photos,
        ]);
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
