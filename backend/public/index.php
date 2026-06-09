<?php

declare(strict_types=1);

use App\Controllers\AdminStatsController;
use App\Controllers\AuthController;
use App\Controllers\DestinationController;
use App\Controllers\HealthController;
use App\Controllers\PublicDestinationController;
use App\Controllers\PublicTripController;
use App\Controllers\TripController;
use App\Http\Response;
use App\Http\Router;

require __DIR__ . '/../bootstrap.php';

// Uncaught failures must never leak stack traces to clients.
set_exception_handler(static function (Throwable $e): void {
    error_log((string) $e);
    Response::error('Internal server error', 500);
});

$router = new Router();

// --- Public ---
$router->get('/api/health', [new HealthController(), 'show']);

// --- Authentication (Phase 2) ---
$auth = new AuthController();
$router->post('/api/auth/login', [$auth, 'login']);        // visitor shared password
$router->post('/api/auth/admin/login', [$auth, 'adminLogin']); // separate admin credentials
$router->get('/api/auth/session', [$auth, 'session']);     // current auth state (+ CSRF token)
$router->post('/api/auth/logout', [$auth, 'logout']);

// --- Public content (visitor-gated, Phase 3) ---
$publicTrips = new PublicTripController();
$publicDestinations = new PublicDestinationController();
$router->get('/api/trips', [$publicTrips, 'index']);
$router->get('/api/trips/:tripSlug/destinations', [$publicDestinations, 'forTrip']);
$router->get('/api/trips/:slug', [$publicTrips, 'show']);
$router->get('/api/destinations/:slug', [$publicDestinations, 'show']);

// --- Admin content management (admin + CSRF, Phase 3) ---
$adminTrips = new TripController();
$adminDestinations = new DestinationController();
$router->get('/api/admin/stats', [new AdminStatsController(), 'index']);

$router->get('/api/admin/trips', [$adminTrips, 'index']);
$router->post('/api/admin/trips', [$adminTrips, 'store']);
$router->get('/api/admin/trips/:id', [$adminTrips, 'show']);
$router->put('/api/admin/trips/:id', [$adminTrips, 'update']);
$router->delete('/api/admin/trips/:id', [$adminTrips, 'destroy']);
$router->get('/api/admin/trips/:id/destinations', [$adminDestinations, 'forTrip']);

$router->post('/api/admin/destinations/reorder', [$adminDestinations, 'reorder']);
$router->post('/api/admin/destinations', [$adminDestinations, 'store']);
$router->get('/api/admin/destinations/:id', [$adminDestinations, 'show']);
$router->put('/api/admin/destinations/:id', [$adminDestinations, 'update']);
$router->delete('/api/admin/destinations/:id', [$adminDestinations, 'destroy']);

$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
