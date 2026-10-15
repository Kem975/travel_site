<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;
use App\Exceptions\VersionConflictException;
use App\Services\ArticleBlocks;
use Throwable;

final class ArticleRepository
{
    private const COLUMNS = 'id, destination_id, lang, title, subtitle, status, version, published_at, created_at, updated_at';

    /** The languages an article can be written in. 'fr' is the original. */
    public const LANGS = ['fr', 'en'];

    public static function lang(mixed $value): string
    {
        return in_array($value, self::LANGS, true) ? (string) $value : 'fr';
    }

    /** @return array<string,mixed>|null */
    public function findByDestinationId(int $destinationId, string $lang = 'fr'): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . ' FROM articles WHERE destination_id = ? AND lang = ? LIMIT 1',
        );
        $stmt->execute([$destinationId, $lang]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed>|null */
    public function findPublishedByDestinationId(int $destinationId, string $lang = 'fr'): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . " FROM articles WHERE destination_id = ? AND lang = ? AND status = 'published' LIMIT 1",
        );
        $stmt->execute([$destinationId, $lang]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** Which languages this destination is readable in, in LANGS order. @return list<string> */
    public function publishedLangs(int $destinationId): array
    {
        $stmt = Database::connection()->prepare(
            "SELECT lang FROM articles WHERE destination_id = ? AND status = 'published'",
        );
        $stmt->execute([$destinationId]);
        $found = $stmt->fetchAll(\PDO::FETCH_COLUMN);
        return array_values(array_filter(self::LANGS, static fn (string $l): bool => in_array($l, $found, true)));
    }

    /**
     * Destination ids readable in *any* language — the journal and globe show a
     * "Read" link either way, and a visitor reading in English still gets there
     * (the article page is what explains the version is missing).
     * @return list<int>
     */
    public function publishedDestinationIds(): array
    {
        $ids = Database::connection()
            ->query("SELECT DISTINCT destination_id FROM articles WHERE status = 'published'")
            ->fetchAll(\PDO::FETCH_COLUMN);
        return array_map('intval', $ids);
    }

    /**
     * The stop whose article was published most recently — what the globe offers
     * on arrival, before anything is clicked.
     *
     * A stop can hold one article per language, and translating an old piece does
     * not make it news; `published_at` is stamped once, on the first publish, so
     * the newest row here is genuinely the newest writing either way.
     *
     * Articles published without a stamp are skipped rather than sorted last: an
     * unknown date cannot be claimed to be the latest.
     */
    public function latestPublishedDestinationId(): ?int
    {
        $id = Database::connection()
            ->query(
                "SELECT destination_id FROM articles
                 WHERE status = 'published' AND published_at IS NOT NULL
                 ORDER BY published_at DESC, id DESC
                 LIMIT 1",
            )
            ->fetchColumn();
        return $id === false || $id === null ? null : (int) $id;
    }

    /** @return list<array{type:string,content:array<string,mixed>}> */
    public function blocks(int $articleId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT block_type, content_json FROM article_blocks WHERE article_id = ? ORDER BY sort_order ASC, id ASC',
        );
        $stmt->execute([$articleId]);
        return array_map(static function (array $row): array {
            $content = json_decode((string) $row['content_json'], true);
            return ['type' => (string) $row['block_type'], 'content' => is_array($content) ? $content : []];
        }, $stmt->fetchAll());
    }

    /**
     * A photo used in a stop's article belongs to that stop.
     *
     * Nothing was setting this: the article editor never handed its destination to
     * the media picker, so anything uploaded or chosen from inside an article kept
     * destination_id NULL — present in the library, embedded in the published page,
     * and invisible in the public gallery, whose query joins through destinations.
     *
     * Only unassigned photos are claimed, so reusing one picture across two stops
     * leaves it with the first, rather than having each save steal it back.
     *
     * @param list<array{type:string,content:mixed}> $blocks
     */
    private function adoptPhotos(\PDO $pdo, int $destinationId, array $blocks): void
    {
        /** @var list<array{type:string,content:array<string,mixed>}> $typed */
        $typed = $blocks;
        $ids = ArticleBlocks::referencedPhotoIds($typed);
        if ($ids === []) {
            return;
        }
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare(
            "UPDATE photos SET destination_id = ? WHERE destination_id IS NULL AND id IN ({$in})",
        );
        $stmt->execute([$destinationId, ...$ids]);
    }

    /**
     * Persist the whole article in one transaction: upsert the article row, update
     * meta + publication state, and replace all blocks. A failure rolls everything
     * back, leaving the previously-saved article intact.
     *
     * Optimistic concurrency: the row is locked (FOR UPDATE) and its version must
     * match $expectedVersion, otherwise a VersionConflictException is thrown.
     *
     * @param array<string,mixed> $meta
     * @param list<array{type:string,content:mixed}> $blocks
     * @return int the new version
     */
    public function save(int $destinationId, string $lang, array $meta, array $blocks, ?int $expectedVersion): int
    {
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $find = $pdo->prepare('SELECT id, version FROM articles WHERE destination_id = ? AND lang = ? FOR UPDATE');
            $find->execute([$destinationId, $lang]);
            $existing = $find->fetch();

            if ($existing !== false) {
                $currentVersion = (int) $existing['version'];
                // A stale (or absent) expected version means someone else saved first.
                if ($expectedVersion === null || $expectedVersion !== $currentVersion) {
                    $pdo->rollBack();
                    throw new VersionConflictException();
                }
                $id = (int) $existing['id'];
                $newVersion = $currentVersion + 1;
            } else {
                $create = $pdo->prepare('INSERT INTO articles (destination_id, lang) VALUES (?, ?)');
                $create->execute([$destinationId, $lang]);
                $id = (int) $pdo->lastInsertId();
                $newVersion = 1;
            }

            $update = $pdo->prepare(
                'UPDATE articles SET title = :title, subtitle = :subtitle, status = :status,
                 version = :version, published_at = :published_at WHERE id = :id',
            );
            $update->execute([
                'title' => $meta['title'],
                'subtitle' => $meta['subtitle'],
                'status' => $meta['status'],
                'version' => $newVersion,
                'published_at' => $meta['published_at'],
                'id' => $id,
            ]);

            $pdo->prepare('DELETE FROM article_blocks WHERE article_id = ?')->execute([$id]);
            $insert = $pdo->prepare(
                'INSERT INTO article_blocks (article_id, block_type, content_json, sort_order) VALUES (?, ?, ?, ?)',
            );
            foreach (array_values($blocks) as $i => $block) {
                $insert->execute([
                    $id,
                    $block['type'],
                    json_encode($block['content'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    $i,
                ]);
            }

            $this->adoptPhotos($pdo, $destinationId, $blocks);

            $pdo->commit();
            return $newVersion;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
