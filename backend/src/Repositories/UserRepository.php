<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;

final class UserRepository
{
    /** @return array<string,mixed>|null */
    public function findByEmail(string $email): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed>|null */
    public function findById(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    public function create(string $email, string $displayName, string $passwordHash, string $role): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO users (email, display_name, password_hash, role) VALUES (?, ?, ?, ?)',
        );
        $stmt->execute([$email, $displayName, $passwordHash, $role]);
        return (int) Database::connection()->lastInsertId();
    }
}
