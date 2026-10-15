<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\SessionRepository;
use App\Repositories\SettingsRepository;

/** Dashboard counts (plan §10.1). Articles/comments/photos land in later phases. */
final class AdminStatsController
{
    private const VISITORS_PER_PAGE = 20;

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

    /**
     * Who is reading: named visitor sessions, most recently active first, paged.
     *
     * One row is one live session, not one person — the same name appears once per
     * device still signed in, which is what makes this a connection log rather than
     * a guest list.
     */
    public function visitors(): void
    {
        $this->guard->requireAdmin();
        $sessions = new SessionRepository();

        $total = $sessions->countNamedVisitors();
        $pages = max(1, (int) ceil($total / self::VISITORS_PER_PAGE));
        // Clamped, not trusted: ?page=0, ?page=abc and ?page=99 all land on a real
        // page, so a stale link never shows an empty list with no way back.
        $page = max(1, min($pages, (int) ($_GET['page'] ?? 1)));

        Response::json([
            'visitors' => $sessions->namedVisitors(self::VISITORS_PER_PAGE, ($page - 1) * self::VISITORS_PER_PAGE),
            'page' => $page,
            'pages' => $pages,
            'total' => $total,
            'per_page' => self::VISITORS_PER_PAGE,
            // The clock to read the timestamps in, sent with them so the dashboard
            // never has to guess — null means "use the reader's own".
            'timezone' => (new SettingsRepository())->departureTimezone(),
        ]);
    }
}
