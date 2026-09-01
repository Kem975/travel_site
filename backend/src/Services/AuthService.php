<?php

declare(strict_types=1);

namespace App\Services;

use App\Config;
use App\Http\Request;
use App\Repositories\SessionRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\UserRepository;
use App\Security\Csrf;
use App\Security\RateLimiter;
use App\Security\Tokens;
use App\Support\Cookies;

/**
 * Visitor gate (shared trip password) and admin login (per-user credentials),
 * both on DB-token sessions (PLAN_REVIEW A4). An admin session also satisfies
 * the visitor gate; the trip password never yields admin scope (plan §15.2).
 */
final class AuthService
{
    private SessionRepository $sessions;
    private SettingsRepository $settings;
    private UserRepository $users;

    public function __construct()
    {
        $this->sessions = new SessionRepository();
        $this->settings = new SettingsRepository();
        $this->users = new UserRepository();
    }

    /** @return array{ok:bool,status:int,body:array<string,mixed>} */
    public function visitorLogin(string $password): array
    {
        $ipHash = RateLimiter::ipHash(Request::clientIp());
        if (!RateLimiter::allow($ipHash, 'visitor')) {
            return $this->fail(429, 'Too many attempts. Please wait a few minutes and try again.');
        }

        $hash = $this->settings->get('trip_password_hash');
        $valid = is_string($hash) && $hash !== '' && password_verify($password, $hash);
        RateLimiter::record($ipHash, 'visitor', $valid);

        if (!$valid) {
            return $this->fail(401, 'Incorrect password.');
        }

        $csrf = $this->startSession('visitor', null);
        return ['ok' => true, 'status' => 200, 'body' => [
            'authenticated' => true,
            'scope' => 'visitor',
            'user' => null,
            'visitor_name' => null,
            'csrf_token' => $csrf,
        ]];
    }

    /** @return array{ok:bool,status:int,body:array<string,mixed>} */
    public function adminLogin(string $email, string $password): array
    {
        $ipHash = RateLimiter::ipHash(Request::clientIp());
        if (!RateLimiter::allow($ipHash, 'admin')) {
            return $this->fail(429, 'Too many attempts. Please wait a few minutes and try again.');
        }

        $user = $this->users->findByEmail($email);
        $valid = $user !== null && password_verify($password, (string) $user['password_hash']);
        RateLimiter::record($ipHash, 'admin', $valid);

        if (!$valid || $user === null) {
            return $this->fail(401, 'Invalid email or password.');
        }

        $csrf = $this->startSession('admin', (int) $user['id']);
        return ['ok' => true, 'status' => 200, 'body' => [
            'authenticated' => true,
            'scope' => 'admin',
            'user' => $this->publicUser($user),
            'visitor_name' => null,
            'csrf_token' => $csrf,
        ]];
    }

    /**
     * Resolve the current session from the cookie.
     * @return array{id:int,scope:string,user:array<string,mixed>|null,visitor_name:string|null,token_hash:string,csrf:string}|null
     */
    public function current(): ?array
    {
        $token = Request::cookie(Cookies::SESSION);
        if (!is_string($token) || $token === '') {
            return null;
        }

        $tokenHash = Tokens::hash($token);
        $session = $this->sessions->findValidByTokenHash($tokenHash);
        if ($session === null) {
            return null;
        }
        $this->sessions->touch((int) $session['id']);

        $user = null;
        if ($session['scope'] === 'admin' && $session['user_id'] !== null) {
            $found = $this->users->findById((int) $session['user_id']);
            $user = $found !== null ? $this->publicUser($found) : null;
        }

        return [
            'id' => (int) $session['id'],
            'scope' => (string) $session['scope'],
            'user' => $user,
            'visitor_name' => $session['visitor_name'] !== null ? (string) $session['visitor_name'] : null,
            'token_hash' => $tokenHash,
            'csrf' => Csrf::tokenFor($tokenHash),
        ];
    }

    /** Self-declared visitor name, asked for after the gate. Returns the stored value. */
    public function nameVisitor(int $sessionId, string $name): string
    {
        $clean = mb_substr(trim($name), 0, 60);
        $this->sessions->setVisitorName($sessionId, $clean);
        return $clean;
    }

    public function logout(): void
    {
        $token = Request::cookie(Cookies::SESSION);
        if (is_string($token) && $token !== '') {
            $this->sessions->deleteByTokenHash(Tokens::hash($token));
        }
        Cookies::clearSession();
    }

    private function startSession(string $scope, ?int $userId): string
    {
        $token = Tokens::random();
        $tokenHash = Tokens::hash($token);
        $days = $this->durationDays();
        $expiresAt = date('Y-m-d H:i:s', time() + $days * 86400);

        $this->sessions->create($scope, $userId, $tokenHash, $expiresAt);
        Cookies::setSession($token, $days);

        return Csrf::tokenFor($tokenHash);
    }

    private function durationDays(): int
    {
        return max(1, (int) (Config::get('SESSION_DURATION_DAYS', '30') ?? '30'));
    }

    /**
     * @param array<string,mixed> $user
     * @return array<string,mixed>
     */
    private function publicUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'email' => $user['email'],
            'display_name' => $user['display_name'],
            'role' => $user['role'],
        ];
    }

    /** @return array{ok:bool,status:int,body:array<string,mixed>} */
    private function fail(int $status, string $message): array
    {
        return ['ok' => false, 'status' => $status, 'body' => ['error' => $message]];
    }
}
