<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use App\Http\Response;
use Throwable;

final class HealthController
{
    public function show(): void
    {
        $database = 'down';
        try {
            Database::connection()->query('SELECT 1');
            $database = 'up';
        } catch (Throwable) {
            $database = 'down';
        }

        Response::json([
            'status' => 'ok',
            'php_version' => PHP_VERSION,
            'database' => $database,
            'time' => gmdate('c'),
        ]);
    }
}
