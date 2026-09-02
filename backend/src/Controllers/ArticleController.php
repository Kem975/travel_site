<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\ArticleRepository;
use App\Repositories\DestinationRepository;
use App\Exceptions\VersionConflictException;
use App\Repositories\PhotoRepository;
use App\Services\ArticleBlocks;
use App\Support\PhotoPresenter;

/**
 * Admin block-editor backend: one article per destination *and language*. The
 * language rides on the request (?lang= to read, "lang" in the body to write) so
 * the editor is the same screen twice, not two screens.
 */
final class ArticleController
{
    private const STATUSES = ['draft', 'scheduled', 'published', 'archived'];

    private AuthMiddleware $guard;
    private DestinationRepository $destinations;
    private ArticleRepository $articles;
    private PhotoRepository $photos;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->destinations = new DestinationRepository();
        $this->articles = new ArticleRepository();
        $this->photos = new PhotoRepository();
    }

    /** @param array<string,string> $params  (destination id) */
    public function show(array $params): void
    {
        $this->guard->requireAdmin();
        $destinationId = (int) $params['id'];
        if ($this->destinations->find($destinationId) === null) {
            Response::error('Destination not found.', 404);
            return;
        }
        $lang = ArticleRepository::lang($_GET['lang'] ?? null);
        $article = $this->articles->findByDestinationId($destinationId, $lang);
        $blocks = $article !== null ? $this->articles->blocks((int) $article['id']) : [];
        Response::json([
            'article' => $article,
            'blocks' => $blocks,
            'photos' => $this->photosFor($blocks),
            'lang' => $lang,
            'langs' => ArticleRepository::LANGS,
        ]);
    }

    /** @param array<string,string> $params */
    public function save(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $destinationId = (int) $params['id'];
        if ($this->destinations->find($destinationId) === null) {
            Response::error('Destination not found.', 404);
            return;
        }
        $data = Request::json();
        $lang = ArticleRepository::lang($data['lang'] ?? null);

        [$blocks, $errors] = ArticleBlocks::normalize(
            is_array($data['blocks'] ?? null) ? $data['blocks'] : [],
            $this->photos,
        );
        if ($errors !== []) {
            Response::json(['errors' => ['blocks' => implode(' ', $errors)]], 422);
            return;
        }

        $existing = $this->articles->findByDestinationId($destinationId, $lang);
        $status = in_array($data['status'] ?? '', self::STATUSES, true) ? $data['status'] : 'draft';
        $publishedAt = $existing !== null ? ($existing['published_at'] ?? null) : null;
        if ($status === 'published' && ($publishedAt === null || $publishedAt === '')) {
            $publishedAt = date('Y-m-d H:i:s');
        }

        $expectedVersion = isset($data['version']) && is_numeric($data['version']) ? (int) $data['version'] : null;

        try {
            $this->articles->save($destinationId, $lang, [
                'title' => $this->strOrNull($data['title'] ?? null),
                'subtitle' => $this->strOrNull($data['subtitle'] ?? null),
                'status' => $status,
                'published_at' => $publishedAt,
            ], $blocks, $expectedVersion);
        } catch (VersionConflictException) {
            // Hand back the current server state so the client can reconcile.
            $current = $this->articles->findByDestinationId($destinationId, $lang);
            $currentBlocks = $current !== null ? $this->articles->blocks((int) $current['id']) : [];
            Response::json([
                'error' => 'This article was changed elsewhere. Reload to get the latest version.',
                'conflict' => true,
                'article' => $current,
                'blocks' => $currentBlocks,
                'photos' => $this->photosFor($currentBlocks),
                'lang' => $lang,
                'langs' => ArticleRepository::LANGS,
            ], 409);
            return;
        }

        $saved = $this->articles->findByDestinationId($destinationId, $lang);
        $savedBlocks = $saved !== null ? $this->articles->blocks((int) $saved['id']) : [];
        Response::json([
            'article' => $saved,
            'blocks' => $savedBlocks,
            'photos' => $this->photosFor($savedBlocks),
            'lang' => $lang,
            'langs' => ArticleRepository::LANGS,
        ]);
    }

    /**
     * @param list<array{type:string,content:array<string,mixed>}> $blocks
     */
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

    private function strOrNull(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $string = trim((string) $value);
        return $string === '' ? null : $string;
    }
}
