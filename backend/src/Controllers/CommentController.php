<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\CommentRepository;

/** Admin comment moderation (plan §10.6). Admin + CSRF on every change. */
final class CommentController
{
    private const STATUSES = ['pending', 'published', 'rejected', 'spam'];

    private AuthMiddleware $guard;
    private CommentRepository $comments;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->comments = new CommentRepository();
    }

    public function index(): void
    {
        $this->guard->requireAdmin();
        $status = isset($_GET['status']) && in_array($_GET['status'], self::STATUSES, true) ? $_GET['status'] : null;
        Response::json(['comments' => $this->comments->allForAdmin($status)]);
    }

    /** @param array<string,string> $params */
    public function update(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $comment = $this->comments->find((int) $params['id']);
        if ($comment === null) {
            Response::error('Comment not found.', 404);
            return;
        }
        $data = Request::json();
        $status = $data['status'] ?? '';
        if (!in_array($status, self::STATUSES, true)) {
            Response::error('Invalid status.', 422);
            return;
        }
        $this->comments->updateStatus((int) $comment['id'], $status);
        Response::json(['comment' => $this->comments->find((int) $comment['id'])]);
    }

    /** Admin reply — a published comment authored by the admin (plan §9.3). @param array<string,string> $params */
    public function reply(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $parent = $this->comments->find((int) $params['id']);
        if ($parent === null) {
            Response::error('Comment not found.', 404);
            return;
        }
        if ($parent['parent_id'] !== null) {
            Response::error('Replies are limited to one level.', 422);
            return;
        }
        $body = trim((string) (Request::json()['body'] ?? ''));
        if ($body === '' || mb_strlen($body) > 5000) {
            Response::error('Reply cannot be empty.', 422);
            return;
        }
        $authorName = is_array($ctx['user']) ? (string) ($ctx['user']['display_name'] ?? 'Admin') : 'Admin';

        $id = $this->comments->create([
            'destination_id' => (int) $parent['destination_id'],
            'parent_id' => (int) $parent['id'],
            'author_name' => $authorName,
            'author_email' => null,
            'body' => $body,
            'status' => 'published',
            'ip_hash' => null,
        ]);
        Response::json(['comment' => $this->comments->find($id)], 201);
    }

    /** @param array<string,string> $params */
    public function destroy(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $comment = $this->comments->find((int) $params['id']);
        if ($comment === null) {
            Response::error('Comment not found.', 404);
            return;
        }
        $this->comments->delete((int) $comment['id']);
        Response::json(['deleted' => true]);
    }
}
