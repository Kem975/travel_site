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
