<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;

final class CommentRepository
{
    /** @return array<string,mixed>|null */
    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM comments WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** Published comments for a destination, oldest first. @return list<array<string,mixed>> */
    public function publishedForDestination(int $destinationId): array
    {
        $stmt = Database::connection()->prepare(
            "SELECT id, parent_id, author_name, body, created_at FROM comments
             WHERE destination_id = ? AND status = 'published' ORDER BY created_at ASC, id ASC",
        );
        $stmt->execute([$destinationId]);
        return $stmt->fetchAll();
    }

    public function countRecentByIp(string $ipHash, int $minutes): int
    {
        $sql = sprintf(
            'SELECT COUNT(*) FROM comments WHERE ip_hash = ? AND created_at > (NOW() - INTERVAL %d MINUTE)',
            $minutes,
        );
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute([$ipHash]);
        return (int) $stmt->fetchColumn();
    }

    /** @param array<string,mixed> $data */
    public function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO comments (destination_id, parent_id, author_name, author_email, body, status, ip_hash)
             VALUES (:destination_id, :parent_id, :author_name, :author_email, :body, :status, :ip_hash)',
        );
        $stmt->execute([
            'destination_id' => $data['destination_id'],
            'parent_id' => $data['parent_id'] ?? null,
            'author_name' => $data['author_name'],
            'author_email' => $data['author_email'] ?? null,
            'body' => $data['body'],
            'status' => $data['status'],
            'ip_hash' => $data['ip_hash'] ?? null,
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    /** @return list<array<string,mixed>> */
    public function allForAdmin(?string $status): array
    {
        $sql = 'SELECT c.id, c.destination_id, c.parent_id, c.author_name, c.author_email, c.body,
                       c.status, c.created_at, d.title AS destination_title, d.slug AS destination_slug
                FROM comments c JOIN destinations d ON d.id = c.destination_id';
        $params = [];
        if ($status !== null) {
            $sql .= ' WHERE c.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY c.created_at DESC, c.id DESC LIMIT 500';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function updateStatus(int $id, string $status): void
    {
        $stmt = Database::connection()->prepare('UPDATE comments SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
    }

    public function delete(int $id): void
    {
        // Replies cascade via the parent_id FK (ON DELETE CASCADE).
        $stmt = Database::connection()->prepare('DELETE FROM comments WHERE id = ?');
        $stmt->execute([$id]);
    }
}
