<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;

final class DestinationRepository
{
    private const COLUMNS = 'id, trip_id, title, slug, country, latitude, longitude, arrival_date, '
        . 'departure_date, excerpt, cover_photo_id, status, sort_order, published_at, created_at, updated_at';

    /** @return list<array<string,mixed>> */
    public function forTrip(int $tripId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . ' FROM destinations WHERE trip_id = ? ORDER BY sort_order ASC, id ASC',
        );
        $stmt->execute([$tripId]);
        return $stmt->fetchAll();
    }

    /**
     * Public view: never expose hidden/cancelled; planned only when settings allow
     * (plan §18 privacy). @return list<array<string,mixed>>
     */
    public function forTripPublic(int $tripId, bool $includePlanned): array
    {
        $sql = 'SELECT ' . self::COLUMNS . " FROM destinations
                WHERE trip_id = ? AND status NOT IN ('hidden','cancelled')";
        if (!$includePlanned) {
            $sql .= " AND status <> 'planned'";
        }
        $sql .= ' ORDER BY sort_order ASC, id ASC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute([$tripId]);
        return $stmt->fetchAll();
    }

    /**
     * The whole journey as one flat list in travel order, across every published
     * country. Same visibility rules as forTripPublic. @return list<array<string,mixed>>
     */
    public function publicRoute(bool $includePlanned): array
    {
        $sql = "SELECT d.id, d.title, d.slug, d.country, d.arrival_date, d.departure_date, d.status,
                       t.slug AS trip_slug, t.title AS trip_title
                FROM destinations d
                JOIN trips t ON t.id = d.trip_id
                WHERE t.status = 'published' AND d.status NOT IN ('hidden','cancelled')";
        if (!$includePlanned) {
            $sql .= " AND d.status <> 'planned'";
        }
        $sql .= ' ORDER BY t.sort_order ASC, t.id ASC, d.sort_order ASC, d.id ASC';
        return Database::connection()->query($sql)->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT ' . self::COLUMNS . ' FROM destinations WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed>|null */
    public function findPublicBySlug(string $slug, bool $includePlanned): ?array
    {
        $sql = 'SELECT d.' . str_replace(', ', ', d.', self::COLUMNS) . '
                FROM destinations d JOIN trips t ON t.id = d.trip_id
                WHERE d.slug = ? AND t.status = \'published\' AND d.status NOT IN (\'hidden\',\'cancelled\')';
        if (!$includePlanned) {
            $sql .= " AND d.status <> 'planned'";
        }
        $sql .= ' LIMIT 1';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    public function slugExistsInTrip(int $tripId, string $slug, ?int $exceptId = null): bool
    {
        if ($exceptId !== null) {
            $stmt = Database::connection()->prepare(
                'SELECT 1 FROM destinations WHERE trip_id = ? AND slug = ? AND id <> ? LIMIT 1',
            );
            $stmt->execute([$tripId, $slug, $exceptId]);
        } else {
            $stmt = Database::connection()->prepare(
                'SELECT 1 FROM destinations WHERE trip_id = ? AND slug = ? LIMIT 1',
            );
            $stmt->execute([$tripId, $slug]);
        }
        return $stmt->fetchColumn() !== false;
    }

    public function maxSortOrder(int $tripId): int
    {
        $stmt = Database::connection()->prepare(
            'SELECT COALESCE(MAX(sort_order), -1) FROM destinations WHERE trip_id = ?',
        );
        $stmt->execute([$tripId]);
        return (int) $stmt->fetchColumn();
    }

    /** @param array<string,mixed> $data */
    public function create(array $data): int
    {
        $params = $this->bindable($data);
        $params['trip_id'] = $data['trip_id'];
        $stmt = Database::connection()->prepare(
            'INSERT INTO destinations
             (trip_id, title, slug, country, latitude, longitude, arrival_date, departure_date, excerpt, status, sort_order, published_at)
             VALUES (:trip_id, :title, :slug, :country, :latitude, :longitude, :arrival_date, :departure_date, :excerpt, :status, :sort_order, :published_at)',
        );
        $stmt->execute($params);
        return (int) Database::connection()->lastInsertId();
    }

    /** @param array<string,mixed> $data */
    public function update(int $id, array $data): void
    {
        $params = $this->bindable($data);
        $params['id'] = $id;
        $stmt = Database::connection()->prepare(
            'UPDATE destinations SET title = :title, slug = :slug, country = :country, latitude = :latitude,
             longitude = :longitude, arrival_date = :arrival_date, departure_date = :departure_date,
             excerpt = :excerpt, status = :status, sort_order = :sort_order, published_at = :published_at
             WHERE id = :id',
        );
        $stmt->execute($params);
    }

    public function delete(int $id): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM destinations WHERE id = ?');
        $stmt->execute([$id]);
    }

    public function setSortOrder(int $id, int $tripId, int $order): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE destinations SET sort_order = ? WHERE id = ? AND trip_id = ?',
        );
        $stmt->execute([$order, $id, $tripId]);
    }

    public function setCover(int $id, ?int $photoId): void
    {
        $stmt = Database::connection()->prepare('UPDATE destinations SET cover_photo_id = ? WHERE id = ?');
        $stmt->execute([$photoId, $id]);
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
            'country' => $data['country'] ?? null,
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'arrival_date' => $data['arrival_date'] ?? null,
            'departure_date' => $data['departure_date'] ?? null,
            'excerpt' => $data['excerpt'] ?? null,
            'status' => $data['status'] ?? 'planned',
            'sort_order' => $data['sort_order'] ?? 0,
            'published_at' => $data['published_at'] ?? null,
        ];
    }
}
