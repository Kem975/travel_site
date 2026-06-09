<?php

declare(strict_types=1);

// Minimal PSR-4 autoloader (App\ -> backend/src). Composer can take over later
// when we add dependencies (e.g. HTML Purifier for PLAN_REVIEW A3).
spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = __DIR__ . '/src/' . $relative . '.php';
    if (is_file($file)) {
        require $file;
    }
});

\App\Config::load(__DIR__);
