<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Minimal path router with `:param` placeholders. Matched named groups are
 * passed to the handler as an associative array.
 */
final class Router
{
    /** @var list<array{method:string,pattern:string,handler:callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = ['method' => strtoupper($method), 'pattern' => $pattern, 'handler' => $handler];
    }

    public function get(string $pattern, callable $handler): void
    {
        $this->add('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->add('POST', $pattern, $handler);
    }

    public function put(string $pattern, callable $handler): void
    {
        $this->add('PUT', $pattern, $handler);
    }

    public function delete(string $pattern, callable $handler): void
    {
        $this->add('DELETE', $pattern, $handler);
    }

    public function dispatch(string $method, string $uri): void
    {
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $path = rtrim($path, '/') ?: '/';
        $method = strtoupper($method);
        $pathMatched = false;

        foreach ($this->routes as $route) {
            if (preg_match($this->compile($route['pattern']), $path, $matches) !== 1) {
                continue;
            }
            $pathMatched = true;
            if ($route['method'] === $method) {
                /** @var array<string,string> $params */
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                ($route['handler'])($params);
                return;
            }
        }

        if ($pathMatched) {
            Response::error('Method not allowed', 405);
        } else {
            Response::error('Not found', 404);
        }
    }

    private function compile(string $pattern): string
    {
        $regex = preg_replace('#:([a-zA-Z_][a-zA-Z0-9_]*)#', '(?<$1>[^/]+)', $pattern);
        return '#^' . $regex . '$#';
    }
}
