<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Services\AuthService;

final class AuthController
{
    private AuthService $auth;

    public function __construct()
    {
        $this->auth = new AuthService();
    }

    public function login(): void
    {
        $data = Request::json();
        $password = isset($data['password']) && is_string($data['password']) ? $data['password'] : '';
        if ($password === '') {
            Response::error('Password is required.', 422);
            return;
        }
        $result = $this->auth->visitorLogin($password);
        Response::json($result['body'], $result['status']);
    }

    public function adminLogin(): void
    {
        $data = Request::json();
        $email = isset($data['email']) && is_string($data['email']) ? trim($data['email']) : '';
        $password = isset($data['password']) && is_string($data['password']) ? $data['password'] : '';
        if ($email === '' || $password === '') {
            Response::error('Email and password are required.', 422);
            return;
        }
        $result = $this->auth->adminLogin($email, $password);
        Response::json($result['body'], $result['status']);
    }

    public function session(): void
    {
        $ctx = $this->auth->current();
        if ($ctx === null) {
            Response::json(['authenticated' => false, 'scope' => null, 'user' => null, 'visitor_name' => null, 'csrf_token' => null]);
            return;
        }
        Response::json([
            'authenticated' => true,
            'scope' => $ctx['scope'],
            'user' => $ctx['user'],
            'visitor_name' => $ctx['visitor_name'],
            'csrf_token' => $ctx['csrf'],
        ]);
    }

    public function setVisitorName(): void
    {
        $ctx = $this->auth->current();
        if ($ctx === null) {
            Response::error('Not authenticated.', 401);
            return;
        }
        (new AuthMiddleware())->requireCsrf($ctx);

        $data = Request::json();
        $name = isset($data['name']) && is_string($data['name']) ? trim($data['name']) : '';
        if ($name === '') {
            Response::error('Name is required.', 422);
            return;
        }
        Response::json(['visitor_name' => $this->auth->nameVisitor($ctx['id'], $name)]);
    }

    public function logout(): void
    {
        $ctx = $this->auth->current();
        if ($ctx !== null) {
            (new AuthMiddleware())->requireCsrf($ctx);
        }
        $this->auth->logout();
        Response::json(['authenticated' => false, 'scope' => null, 'user' => null, 'visitor_name' => null, 'csrf_token' => null]);
    }
}
