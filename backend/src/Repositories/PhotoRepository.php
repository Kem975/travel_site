<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;

final class PhotoRepository
{
    private const COLUMNS = 'id, destination_id, trip_id, filename, storage_path, original_filename, '
        . 'mime_type, width, height, variants, alt_text, caption, category, taken_at, latitude, longitude, '
        . 'sort_order, is_featured, created_at, updated_at';

    /** @return array<string,mixed>|null */
    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT ' . self::COLUMNS . ' FROM photos WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /**
     * @param array{destination_id?:int|null,trip_id?:int|null,unassigned?:bool,category?:?string} $filters
     * @return list<array<string,mixed>>
     */
    public function all(array $filters = []): array
    {
        $where = [];
        $params = [];
        if (!empty($filters['unassigned'])) {
            $where[] = 'destination_id IS NULL';
        } elseif (isset($filters['destination_id']) && $filters['destination_id'] !== null) {
            $where[] = 'destination_id = ?';
            $params[] = $filters['destination_id'];
        }
        if (isset($filters['trip_id']) && $filters['trip_id'] !== null) {
            $where[] = 'trip_id = ?';
            $params[] = $filters['trip_id'];
        }
        if (isset($filters['category']) && $filters['category'] !== null && $filters['category'] !== '') {
            $where[] = 'category = ?';
            $params[] = $filters['category'];
        }

        $sql = 'SELECT ' . self::COLUMNS . ' FROM photos';
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY created_at DESC, id DESC LIMIT 500';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /** @param array<string,mixed> $data */
    public function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO photos
             (destination_id, trip_id, filename, storage_path, original_filename, mime_type, width, height,
              variants, alt_text, caption, category)
             VALUES (:destination_id, :trip_id, :filename, :storage_path, :original_filename, :mime_type,
              :width, :height, :variants, :alt_text, :caption, :category)',
        );
        $stmt->execute([
            'destination_id' => $data['destination_id'] ?? null,
            'trip_id' => $data['trip_id'] ?? null,
            'filename' => $data['filename'],
            'storage_path' => $data['storage_path'],
            'original_filename' => $data['original_filename'] ?? null,
            'mime_type' => $data['mime_type'] ?? 'image/webp',
            'width' => $data['width'],
            'height' => $data['height'],
            'variants' => $data['variants'],
            'alt_text' => $data['alt_text'] ?? null,
            'caption' => $data['caption'] ?? null,
            'category' => $data['category'] ?? null,
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    /** @param array<string,mixed> $data */
    public function updateMeta(int $id, array $data): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE photos SET destination_id = :destination_id, trip_id = :trip_id, alt_text = :alt_text,
             caption = :caption, category = :category, is_featured = :is_featured WHERE id = :id',
        );
        $stmt->execute([
            'destination_id' => $data['destination_id'],
            'trip_id' => $data['trip_id'],
            'alt_text' => $data['alt_text'],
            'caption' => $data['caption'],
            'category' => $data['category'],
            'is_featured' => $data['is_featured'] ? 1 : 0,
            'id' => $id,
        ]);
    }

    public function delete(int $id): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM photos WHERE id = ?');
        $stmt->execute([$id]);
    }

    /**
     * Where a photo is still used — so deletion can be refused (409) instead of
     * orphaning a cover or an article image/gallery block.
     * @return list<string>
     */
    public function references(int $id): array
    {
        $pdo = Database::connection();
        $count = static function (string $sql, mixed $param) use ($pdo): int {
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$param]);
            return (int) $stmt->fetchColumn();
        };

        // Nowdoc keeps the JSON paths literal and portable (no ANSI_QUOTES assumption).
        // Compare JSON-to-JSON (a bare `= ?` won't match a JSON number reliably).
        $imageSql = <<<'SQL'
            SELECT COUNT(*) FROM article_blocks
            WHERE block_type = 'image' AND JSON_EXTRACT(content_json, '$.photoId') = CAST(? AS JSON)
            SQL;
        $gallerySql = <<<'SQL'
            SELECT COUNT(*) FROM article_blocks
            WHERE block_type = 'gallery' AND JSON_CONTAINS(JSON_EXTRACT(content_json, '$.photoIds'), CAST(? AS JSON))
            SQL;

        $reasons = [];
        if ($count('SELECT COUNT(*) FROM trips WHERE cover_photo_id = ?', $id) > 0) {
            $reasons[] = 'trip cover';
        }
        if ($count('SELECT COUNT(*) FROM destinations WHERE cover_photo_id = ?', $id) > 0) {
            $reasons[] = 'destination cover';
        }
        if ($count($imageSql, (string) $id) > 0) {
            $reasons[] = 'article image';
        }
        if ($count($gallerySql, (string) $id) > 0) {
            $reasons[] = 'gallery';
        }
        return $reasons;
    }

    /** @return list<array{filename:string,storage_path:string,variants:mixed}> */
    public function allForGc(): array
    {
        return Database::connection()
            ->query('SELECT filename, storage_path, variants FROM photos')
            ->fetchAll();
    }
}
