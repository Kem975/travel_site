<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\SessionRepository;

/** Dashboard counts (plan §10.1). Articles/comments/photos land in later phases. */
final class AdminStatsController
{
    private AuthMiddleware $guard;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
    }

    public function index(): void
    {
        $this->guard->requireAdmin();
        $pdo = Database::connection();
        $count = static fn (string $sql): int => (int) $pdo->query($sql)->fetchColumn();

        Response::json(['stats' => [
            'trips' => $count('SELECT COUNT(*) FROM trips'),
            'destinations' => $count('SELECT COUNT(*) FROM destinations'),
            'published_articles' => $count("SELECT COUNT(*) FROM articles WHERE status = 'published'"),
            'draft_articles' => $count("SELECT COUNT(*) FROM articles WHERE status = 'draft'"),
            'pending_comments' => $count("SELECT COUNT(*) FROM comments WHERE status = 'pending'"),
            'photos' => $count('SELECT COUNT(*) FROM photos'),
        ]]);
    }

    /** Who is reading: named visitor sessions, most recently active first. */
    public function visitors(): void
    {
        $this->guard->requireAdmin();
        Response::json(['visitors' => (new SessionRepository())->namedVisitors()]);
    }
}
