<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\DestinationRepository;
use App\Repositories\PhotoRepository;
use App\Repositories\RecipeRepository;
use App\Repositories\TripRepository;
use App\Services\ArticleBlocks;
use App\Support\PhotoPresenter;
use App\Support\Slug;

/**
 * Admin recipe management. Identity (country, stop, slug, cover) is edited once;
 * the words are edited once per language, the same shape as articles.
 */
final class RecipeController
{
    private const STATUSES = ['draft', 'published'];

    private AuthMiddleware $guard;
    private RecipeRepository $recipes;
    private TripRepository $trips;
    private DestinationRepository $destinations;
    private PhotoRepository $photos;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->recipes = new RecipeRepository();
        $this->trips = new TripRepository();
        $this->destinations = new DestinationRepository();
        $this->photos = new PhotoRepository();
    }

    public function index(): void
    {
        $this->guard->requireAdmin();
        $recipes = array_map(function (array $row): array {
            $row['langs'] = $row['langs'] === null ? [] : explode(',', (string) $row['langs']);
            $row['cover'] = $this->presentPhoto($row['cover_photo_id']);
            return $row;
        }, $this->recipes->all());
        Response::json(['recipes' => $recipes]);
    }

    /** @param array<string,string> $params */
    public function show(array $params): void
    {
        $this->guard->requireAdmin();
        $recipe = $this->recipes->find((int) $params['id']);
        if ($recipe === null) {
            Response::error('Recipe not found.', 404);
            return;
        }
        $lang = RecipeRepository::lang($_GET['lang'] ?? null);
        $translation = $this->recipes->translation((int) $recipe['id'], $lang);
        $blocks = $translation !== null ? $this->recipes->blocks((int) $translation['translation_id']) : [];

        Response::json([
            'recipe' => $recipe + ['cover' => $this->presentPhoto($recipe['cover_photo_id'])],
            'translation' => $translation === null ? null : $this->presentTranslation($translation),
            'blocks' => $blocks,
            'photos' => $this->photosFor($blocks),
            'lang' => $lang,
            'langs' => RecipeRepository::LANGS,
        ]);
    }

    public function store(): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $data = Request::json();
        $title = trim((string) ($data['title'] ?? ''));
        $tripId = (int) ($data['trip_id'] ?? 0);
        if ($title === '' || $this->trips->find($tripId) === null) {
            Response::json(['errors' => ['title' => 'A title and an existing country are required.']], 422);
            return;
        }

        $id = $this->recipes->create([
            'trip_id' => $tripId,
            'destination_id' => $this->destinationId($data['destination_id'] ?? null, $tripId),
            'slug' => $this->uniqueSlug($title, null),
            'sort_order' => $this->recipes->maxSortOrder() + 1,
        ]);
        // The title belongs to a language, so creating a recipe also creates its
        // French draft — otherwise a recipe would exist with no words at all.
        $this->recipes->saveTranslation($id, 'fr', [
            'title' => $title,
            'subtitle' => null,
            'ingredients' => [],
            'steps' => [],
            'status' => 'draft',
            'published_at' => null,
        ], []);

        Response::json(['recipe' => $this->recipes->find($id)], 201);
    }

    /** @param array<string,string> $params */
    public function update(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $id = (int) $params['id'];
        $recipe = $this->recipes->find($id);
        if ($recipe === null) {
            Response::error('Recipe not found.', 404);
            return;
        }
        $data = Request::json();
        $tripId = (int) ($data['trip_id'] ?? $recipe['trip_id']);
        if ($this->trips->find($tripId) === null) {
            Response::json(['errors' => ['trip_id' => 'Unknown country.']], 422);
            return;
        }
        $slug = trim((string) ($data['slug'] ?? ''));

        $this->recipes->update($id, [
            'trip_id' => $tripId,
            'destination_id' => $this->destinationId($data['destination_id'] ?? null, $tripId),
            'slug' => $this->uniqueSlug($slug !== '' ? $slug : (string) $recipe['slug'], $id),
        ]);
        Response::json(['recipe' => $this->recipes->find($id)]);
    }

    /** @param array<string,string> $params */
    public function saveTranslation(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $id = (int) $params['id'];
        if ($this->recipes->find($id) === null) {
            Response::error('Recipe not found.', 404);
            return;
        }
        $data = Request::json();
        $lang = RecipeRepository::lang($data['lang'] ?? null);

        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') {
            Response::json(['errors' => ['title' => 'A title is required.']], 422);
            return;
        }

        [$blocks, $errors] = ArticleBlocks::normalize(
            is_array($data['blocks'] ?? null) ? $data['blocks'] : [],
            $this->photos,
        );
        if ($errors !== []) {
            Response::json(['errors' => ['blocks' => implode(' ', $errors)]], 422);
            return;
        }

        $existing = $this->recipes->translation($id, $lang);
        $status = in_array($data['status'] ?? '', self::STATUSES, true) ? $data['status'] : 'draft';
        $publishedAt = $existing !== null ? ($existing['published_at'] ?? null) : null;
        if ($status === 'published' && ($publishedAt === null || $publishedAt === '')) {
            $publishedAt = date('Y-m-d H:i:s');
        }

        $this->recipes->saveTranslation($id, $lang, [
            'title' => mb_substr($title, 0, 200),
            'subtitle' => $this->strOrNull($data['subtitle'] ?? null),
            'ingredients' => $this->lines($data['ingredients'] ?? null),
            'steps' => $this->lines($data['steps'] ?? null),
            'status' => $status,
            'published_at' => $publishedAt,
        ], $blocks);

        $saved = $this->recipes->translation($id, $lang);
        $savedBlocks = $saved !== null ? $this->recipes->blocks((int) $saved['translation_id']) : [];
        Response::json([
            'translation' => $saved === null ? null : $this->presentTranslation($saved),
            'blocks' => $savedBlocks,
            'photos' => $this->photosFor($savedBlocks),
            'lang' => $lang,
        ]);
    }

    /** @param array<string,string> $params */
    public function setCover(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $id = (int) $params['id'];
        if ($this->recipes->find($id) === null) {
            Response::error('Recipe not found.', 404);
            return;
        }
        $data = Request::json();
        $photoId = isset($data['photo_id']) && $data['photo_id'] !== null && $data['photo_id'] !== ''
            ? (int) $data['photo_id']
            : null;
        if ($photoId !== null && $this->photos->find($photoId) === null) {
            Response::error('Photo not found.', 422);
            return;
        }
        $this->recipes->setCover($id, $photoId);
        Response::json(['recipe' => $this->recipes->find($id)]);
    }

    /** @param array<string,string> $params */
    public function destroy(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $id = (int) $params['id'];
        if ($this->recipes->find($id) === null) {
            Response::error('Recipe not found.', 404);
            return;
        }
        $this->recipes->delete($id);
        Response::json(['deleted' => true]);
    }

    /** A stop only counts when it belongs to the recipe's own country. */
    private function destinationId(mixed $value, int $tripId): ?int
    {
        if ($value === null || $value === '' || (int) $value <= 0) {
            return null;
        }
        $destination = $this->destinations->find((int) $value);
        return $destination !== null && (int) $destination['trip_id'] === $tripId ? (int) $destination['id'] : null;
    }

    /** @return list<string> */
    private function lines(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        $out = [];
        foreach ($value as $line) {
            $line = trim((string) $line);
            if ($line !== '') {
                $out[] = mb_substr($line, 0, 500);
            }
        }
        return $out;
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function presentTranslation(array $row): array
    {
        $row['ingredients'] = json_decode((string) $row['ingredients'], true) ?: [];
        $row['steps'] = json_decode((string) $row['steps'], true) ?: [];
        return $row;
    }

    /** @param list<array{type:string,content:array<string,mixed>}> $blocks */
    private function photosFor(array $blocks): object
    {
        $map = [];
        foreach (ArticleBlocks::referencedPhotoIds($blocks) as $photoId) {
            $photo = $this->photos->find($photoId);
            if ($photo !== null) {
                $map[(string) $photoId] = PhotoPresenter::present($photo);
            }
        }
        return (object) $map;
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

    private function uniqueSlug(string $base, ?int $exceptId): string
    {
        $slug = Slug::make($base);
        $candidate = $slug;
        $i = 2;
        while ($this->recipes->slugExists($candidate, $exceptId)) {
            $candidate = $slug . '-' . $i++;
        }
        return $candidate;
    }

    private function strOrNull(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $string = trim((string) $value);
        return $string === '' ? null : mb_substr($string, 0, 300);
    }
}
