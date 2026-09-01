<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;

final class TripRepository
{
    private const COLUMNS = 'id, title, slug, description, cover_photo_id, start_date, end_date, '
        . 'status, visibility, sort_order, created_at, updated_at';
    // Route order, not recency: the globe draws one continuous line through these.
    private const ORDER = ' ORDER BY sort_order ASC, id ASC';

    /** @return list<array<string,mixed>> */
    public function all(): array
    {
        return Database::connection()
            ->query('SELECT ' . self::COLUMNS . ' FROM trips' . self::ORDER)
            ->fetchAll();
    }

    /** @return list<array<string,mixed>> */
    public function allPublished(): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . " FROM trips WHERE status = 'published'" . self::ORDER,
        );
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT ' . self::COLUMNS . ' FROM trips WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed>|null */
    public function findPublishedBySlug(string $slug): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . " FROM trips WHERE slug = ? AND status = 'published' LIMIT 1",
        );
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    public function slugExists(string $slug, ?int $exceptId = null): bool
    {
        if ($exceptId !== null) {
            $stmt = Database::connection()->prepare('SELECT 1 FROM trips WHERE slug = ? AND id <> ? LIMIT 1');
            $stmt->execute([$slug, $exceptId]);
        } else {
            $stmt = Database::connection()->prepare('SELECT 1 FROM trips WHERE slug = ? LIMIT 1');
            $stmt->execute([$slug]);
        }
        return $stmt->fetchColumn() !== false;
    }

    public function maxSortOrder(): int
    {
        return (int) Database::connection()
            ->query('SELECT COALESCE(MAX(sort_order), -1) FROM trips')
            ->fetchColumn();
    }

    /** @param array<string,mixed> $data */
    public function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO trips (title, slug, description, start_date, end_date, status, visibility, sort_order)
             VALUES (:title, :slug, :description, :start_date, :end_date, :status, :visibility, :sort_order)',
        );
        $stmt->execute($this->bindable($data));
        return (int) Database::connection()->lastInsertId();
    }

    /** @param array<string,mixed> $data */
    public function update(int $id, array $data): void
    {
        $params = $this->bindable($data);
        $params['id'] = $id;
        $stmt = Database::connection()->prepare(
            'UPDATE trips SET title = :title, slug = :slug, description = :description,
             start_date = :start_date, end_date = :end_date, status = :status, visibility = :visibility,
             sort_order = :sort_order
             WHERE id = :id',
        );
        $stmt->execute($params);
    }

    public function delete(int $id): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM trips WHERE id = ?');
        $stmt->execute([$id]);
    }

    public function setCover(int $id, ?int $photoId): void
    {
        $stmt = Database::connection()->prepare('UPDATE trips SET cover_photo_id = ? WHERE id = ?');
        $stmt->execute([$photoId, $id]);
    }

    public function setSortOrder(int $id, int $order): void
    {
        $stmt = Database::connection()->prepare('UPDATE trips SET sort_order = ? WHERE id = ?');
        $stmt->execute([$order, $id]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    private function bindable(array $data): array
    {
        return [
            'title' => $data['title'],
            'slug' => $data['slug'],
            'description' => $data['description'] ?? null,
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'visibility' => $data['visibility'] ?? 'password_protected',
            'sort_order' => $data['sort_order'] ?? 0,
        ];
    }
}
