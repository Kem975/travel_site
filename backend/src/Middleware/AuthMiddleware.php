<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Http\Request;
use App\Http\Response;
use App\Security\Csrf;
use App\Services\AuthService;

/**
 * Route guards. The whole site is private, so content routes call requireVisitor
 * and admin routes call requireAdmin (PLAN_REVIEW A2). On failure they emit a
 * response and stop the request.
 */
final class AuthMiddleware
{
    private AuthService $auth;

    public function __construct()
    {
        $this->auth = new AuthService();
    }

    /** @return array{scope:string,user:array<string,mixed>|null,token_hash:string,csrf:string} */
    public function requireVisitor(): array
    {
        $ctx = $this->auth->current();
        if ($ctx === null) {
            Response::error('Authentication required.', 401);
            exit;
        }
        return $ctx; // visitor OR admin scope both pass the site gate
    }

    /** @return array{scope:string,user:array<string,mixed>|null,token_hash:string,csrf:string} */
    public function requireAdmin(): array
    {
        $ctx = $this->auth->current();
        if ($ctx === null || $ctx['scope'] !== 'admin') {
            Response::error('Admin authentication required.', 403);
            exit;
        }
        return $ctx;
    }

    /**
     * Enforce CSRF on a state-changing request for an authenticated session.
     * @param array{token_hash:string} $ctx
     */
    public function requireCsrf(array $ctx): void
    {
        $provided = Request::header('X-CSRF-Token') ?? '';
        if (!Csrf::check($provided, $ctx['token_hash'])) {
            Response::error('Invalid or missing CSRF token.', 419);
            exit;
        }
    }
}
