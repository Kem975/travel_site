<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\CommentRepository;
use App\Repositories\DestinationRepository;
use App\Repositories\SettingsRepository;
use App\Security\FormToken;
use App\Security\RateLimiter;

/**
 * Public comment thread + posting (visitor-gated). Anti-spam: honeypot,
 * minimum-fill-time (signed token), and a per-IP rate limit. New comments are
 * pending by default; moderation publishes them.
 */
final class PublicCommentController
{
    private const MIN_FILL_SECONDS = 3;
    private const MAX_FORM_AGE_SECONDS = 7200;
    private const RATE_WINDOW_MINUTES = 10;
    private const RATE_MAX = 5;

    private AuthMiddleware $guard;
    private DestinationRepository $destinations;
    private CommentRepository $comments;
    private SettingsRepository $settings;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->destinations = new DestinationRepository();
        $this->comments = new CommentRepository();
        $this->settings = new SettingsRepository();
    }

    /** @param array<string,string> $params  (destination slug) */
    public function index(array $params): void
    {
        $this->guard->requireVisitor();
        $destination = $this->resolve($params['slug']);
        if ($destination === null) {
            Response::error('Destination not found.', 404);
            return;
        }
        $enabled = $this->settings->get('comments_enabled') !== '0';
        Response::json([
            'comments_enabled' => $enabled,
            'comments' => $enabled ? $this->thread((int) $destination['id']) : [],
            'form_token' => FormToken::issue(),
        ]);
    }

    /** @param array<string,string> $params */
    public function store(array $params): void
    {
        $ctx = $this->guard->requireVisitor();
        $this->guard->requireCsrf($ctx);

        $destination = $this->resolve($params['slug']);
        if ($destination === null) {
            Response::error('Destination not found.', 404);
            return;
        }
        if ($this->settings->get('comments_enabled') === '0') {
            Response::error('Comments are closed.', 403);
            return;
        }

        $data = Request::json();

        // Honeypot: a hidden field only bots fill — accept silently, store nothing.
        if (trim((string) ($data['website'] ?? '')) !== '') {
            Response::json(['ok' => true, 'status' => 'pending'], 201);
            return;
        }
        // Minimum fill time (signed, so the timestamp can't be backdated).
        if (!FormToken::valid((string) ($data['form_token'] ?? ''), self::MIN_FILL_SECONDS, self::MAX_FORM_AGE_SECONDS)) {
            Response::error('Please take a moment and try again.', 422);
            return;
        }

        $ipHash = RateLimiter::ipHash(Request::clientIp());
        if ($this->comments->countRecentByIp($ipHash, self::RATE_WINDOW_MINUTES) >= self::RATE_MAX) {
            Response::error('You are commenting too quickly. Please wait a few minutes.', 429);
            return;
        }

        $name = trim((string) ($data['author_name'] ?? ''));
        $body = trim((string) ($data['body'] ?? ''));
        $email = trim((string) ($data['author_email'] ?? ''));
        $errors = [];
        if ($name === '' || mb_strlen($name) > 120) {
            $errors['author_name'] = 'Please enter your name.';
        }
        if ($body === '' || mb_strlen($body) > 5000) {
            $errors['body'] = 'Please enter a comment (up to 5000 characters).';
        }
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $errors['author_email'] = 'Please enter a valid email or leave it blank.';
        }
        if ($errors !== []) {
            Response::json(['errors' => $errors], 422);
            return;
        }

        // One reply level: a parent must be a published, top-level comment here.
        $parentId = isset($data['parent_id']) && $data['parent_id'] !== null && $data['parent_id'] !== ''
            ? (int) $data['parent_id']
            : null;
        if ($parentId !== null) {
            $parent = $this->comments->find($parentId);
            if (
                $parent === null
                || (int) $parent['destination_id'] !== (int) $destination['id']
                || $parent['parent_id'] !== null
                || $parent['status'] !== 'published'
            ) {
                Response::error('Invalid reply target.', 422);
                return;
            }
        }

        $status = $this->settings->get('comments_require_approval') === '0' ? 'published' : 'pending';
        $this->comments->create([
            'destination_id' => (int) $destination['id'],
            'parent_id' => $parentId,
            'author_name' => $name,
            'author_email' => $email === '' ? null : $email,
            'body' => $body,
            'status' => $status,
            'ip_hash' => $ipHash,
        ]);

        Response::json(['ok' => true, 'status' => $status], 201);
    }

    /** @return array<string,mixed>|null */
    private function resolve(string $slug): ?array
    {
        $includePlanned = $this->settings->get('future_destinations_visible') === '1';
        return $this->destinations->findPublicBySlug($slug, $includePlanned);
    }

    /**
     * Flat published comments → one level of nesting (top-level + replies).
     * @return list<array<string,mixed>>
     */
    private function thread(int $destinationId): array
    {
        $top = [];
        $repliesByParent = [];
        foreach ($this->comments->publishedForDestination($destinationId) as $row) {
            $node = [
                'id' => (int) $row['id'],
                'author_name' => $row['author_name'],
                'body' => $row['body'],
                'created_at' => $row['created_at'],
            ];
            if ($row['parent_id'] === null) {
                $top[(int) $row['id']] = $node + ['replies' => []];
            } else {
                $repliesByParent[(int) $row['parent_id']][] = $node;
            }
        }
        foreach ($repliesByParent as $parentId => $replies) {
            if (isset($top[$parentId])) {
                $top[$parentId]['replies'] = $replies;
            }
        }
        return array_values($top);
    }
}
