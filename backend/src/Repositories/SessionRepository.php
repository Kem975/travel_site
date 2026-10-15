<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;

final class SessionRepository
{
    public function create(string $scope, ?int $userId, string $tokenHash, string $expiresAt): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO sessions (scope, user_id, session_token_hash, expires_at, last_used_at)
             VALUES (?, ?, ?, ?, NOW())',
        );
        $stmt->execute([$scope, $userId, $tokenHash, $expiresAt]);
    }

    /** @return array<string,mixed>|null */
    public function findValidByTokenHash(string $tokenHash): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM sessions WHERE session_token_hash = ? AND expires_at > NOW() LIMIT 1',
        );
        $stmt->execute([$tokenHash]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    public function setVisitorName(int $id, string $name): void
    {
        $stmt = Database::connection()->prepare('UPDATE sessions SET visitor_name = ? WHERE id = ?');
        $stmt->execute([$name, $id]);
    }

    /** The rows both visitor queries below work over — one named, live session each. */
    private const NAMED_VISITORS_WHERE =
        "FROM sessions
         WHERE scope = 'visitor' AND visitor_name IS NOT NULL AND expires_at > NOW()";

    /**
     * One page of named visitor sessions, most recently active first.
     *
     * `id DESC` closes the ordering: last_used_at is null until a session is used
     * a second time, and ties on it would otherwise let a row sit on two pages or
     * on none as the page changes.
     *
     * @return list<array<string,mixed>>
     */
    public function namedVisitors(int $limit, int $offset): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT visitor_name,
                    UNIX_TIMESTAMP(created_at)   AS created_ts,
                    UNIX_TIMESTAMP(last_used_at) AS last_used_ts
             ' . self::NAMED_VISITORS_WHERE . '
             ORDER BY last_used_at DESC, created_at DESC, id DESC
             LIMIT :limit OFFSET :offset',
        );
        // Bound as integers: prepares are native here, so a string would reach
        // MySQL quoted and LIMIT '20' is a syntax error.
        $stmt->bindValue(':limit', max(1, $limit), \PDO::PARAM_INT);
        $stmt->bindValue(':offset', max(0, $offset), \PDO::PARAM_INT);
        $stmt->execute();

        // Epochs, not the raw DATETIME. These columns are written by MySQL's NOW(),
        // so their wall-clock reading only means something next to the database
        // server's own time zone — which the browser has no way of knowing, and
        // would otherwise read as its own. UNIX_TIMESTAMP resolves them against
        // that zone here, with the DST rules that applied on the day in question,
        // and what leaves is an instant anyone can render in any clock.
        return array_map(static fn (array $row): array => [
            'visitor_name' => $row['visitor_name'],
            'created_ts' => (int) $row['created_ts'],
            'last_used_ts' => $row['last_used_ts'] === null ? null : (int) $row['last_used_ts'],
        ], $stmt->fetchAll());
    }

    /** How many there are in total, for the page count. */
    public function countNamedVisitors(): int
    {
        return (int) Database::connection()
            ->query('SELECT COUNT(*) ' . self::NAMED_VISITORS_WHERE)
            ->fetchColumn();
    }

    public function touch(int $id): void
    {
        $stmt = Database::connection()->prepare('UPDATE sessions SET last_used_at = NOW() WHERE id = ?');
        $stmt->execute([$id]);
    }

    public function deleteByTokenHash(string $tokenHash): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM sessions WHERE session_token_hash = ?');
        $stmt->execute([$tokenHash]);
    }

    public function gcExpired(): void
    {
        Database::connection()->query('DELETE FROM sessions WHERE expires_at < NOW()');
    }
}
