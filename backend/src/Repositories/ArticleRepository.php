<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;
use App\Exceptions\VersionConflictException;
use Throwable;

final class ArticleRepository
{
    private const COLUMNS = 'id, destination_id, title, subtitle, status, version, published_at, created_at, updated_at';

    /** @return array<string,mixed>|null */
    public function findByDestinationId(int $destinationId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . ' FROM articles WHERE destination_id = ? LIMIT 1',
        );
        $stmt->execute([$destinationId]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed>|null */
    public function findPublishedByDestinationId(int $destinationId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . " FROM articles WHERE destination_id = ? AND status = 'published' LIMIT 1",
        );
        $stmt->execute([$destinationId]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
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
    public function save(int $destinationId, array $meta, array $blocks, ?int $expectedVersion): int
    {
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $find = $pdo->prepare('SELECT id, version FROM articles WHERE destination_id = ? FOR UPDATE');
            $find->execute([$destinationId]);
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
                $create = $pdo->prepare('INSERT INTO articles (destination_id) VALUES (?)');
                $create->execute([$destinationId]);
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
