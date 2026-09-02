<?php

declare(strict_types=1);

use App\Controllers\AdminStatsController;
use App\Controllers\ArticleController;
use App\Controllers\AuthController;
use App\Controllers\CommentController;
use App\Controllers\DestinationController;
use App\Controllers\GeocodeController;
use App\Controllers\HealthController;
use App\Controllers\PhotoController;
use App\Controllers\PublicArticleController;
use App\Controllers\PublicCommentController;
use App\Controllers\PublicDestinationController;
use App\Controllers\PublicGalleryController;
use App\Controllers\PublicGlobeController;
use App\Controllers\PublicJournalController;
use App\Controllers\PublicJourneyController;
use App\Controllers\PublicRecipeController;
use App\Controllers\RecipeController;
use App\Controllers\PublicTripController;
use App\Controllers\TripController;
use App\Http\Response;
use App\Http\Router;
use App\Support\Storage;

require __DIR__ . '/../bootstrap.php';

// API responses must be clean JSON — never let a notice/warning leak into the body.
// Errors are logged instead (set_exception_handler below covers fatals).
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Dev only: serve uploaded media. In production Apache serves /uploads directly
// (real files short-circuit the rewrite), so this never runs there.
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
if (str_starts_with($requestPath, '/uploads/')) {
    Storage::serve(rawurldecode(substr($requestPath, strlen('/uploads/'))));
    return;
}

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
$router->post('/api/auth/name', [$auth, 'setVisitorName']); // self-declared, asked after the gate
$router->post('/api/auth/logout', [$auth, 'logout']);

// --- Public content (visitor-gated, Phase 3) ---
$publicTrips = new PublicTripController();
$publicDestinations = new PublicDestinationController();
$router->get('/api/trips', [$publicTrips, 'index']);
$router->get('/api/journal', [new PublicJournalController(), 'index']);
$router->get('/api/gallery', [new PublicGalleryController(), 'index']);
$router->get('/api/globe', [new PublicGlobeController(), 'index']);
$router->get('/api/journey/timeline', [new PublicJourneyController(), 'timeline']);

$publicRecipes = new PublicRecipeController();
$router->get('/api/recipes', [$publicRecipes, 'index']);
$router->get('/api/recipes/:slug', [$publicRecipes, 'show']);
$router->get('/api/trips/:tripSlug/destinations', [$publicDestinations, 'forTrip']);
$router->get('/api/trips/:slug', [$publicTrips, 'show']);
$router->get('/api/destinations/:slug/article', [new PublicArticleController(), 'show']);
$publicComments = new PublicCommentController();
$router->get('/api/destinations/:slug/comments', [$publicComments, 'index']);
$router->post('/api/destinations/:slug/comments', [$publicComments, 'store']);
$router->get('/api/destinations/:slug', [$publicDestinations, 'show']);

// --- Admin content management (admin + CSRF, Phase 3) ---
$adminTrips = new TripController();
$adminDestinations = new DestinationController();
$adminStats = new AdminStatsController();
$router->get('/api/admin/stats', [$adminStats, 'index']);
$router->get('/api/admin/visitors', [$adminStats, 'visitors']);
$router->get('/api/admin/geocode', [new GeocodeController(), 'search']);

$adminRecipes = new RecipeController();
$router->get('/api/admin/recipes', [$adminRecipes, 'index']);
$router->post('/api/admin/recipes', [$adminRecipes, 'store']);
$router->get('/api/admin/recipes/:id', [$adminRecipes, 'show']);
$router->put('/api/admin/recipes/:id', [$adminRecipes, 'update']);
$router->put('/api/admin/recipes/:id/translation', [$adminRecipes, 'saveTranslation']);
$router->put('/api/admin/recipes/:id/cover', [$adminRecipes, 'setCover']);
$router->delete('/api/admin/recipes/:id', [$adminRecipes, 'destroy']);

$router->get('/api/admin/trips', [$adminTrips, 'index']);
$router->post('/api/admin/trips/reorder', [$adminTrips, 'reorder']);
$router->post('/api/admin/trips', [$adminTrips, 'store']);
$router->get('/api/admin/trips/:id', [$adminTrips, 'show']);
$router->put('/api/admin/trips/:id', [$adminTrips, 'update']);
$router->delete('/api/admin/trips/:id', [$adminTrips, 'destroy']);
$router->get('/api/admin/trips/:id/destinations', [$adminDestinations, 'forTrip']);

$router->post('/api/admin/destinations/reorder', [$adminDestinations, 'reorder']);
$router->post('/api/admin/destinations', [$adminDestinations, 'store']);
$router->get('/api/admin/destinations/:id', [$adminDestinations, 'show']);
$router->put('/api/admin/destinations/:id', [$adminDestinations, 'update']);
$router->put('/api/admin/destinations/:id/cover', [$adminDestinations, 'setCover']);
$router->delete('/api/admin/destinations/:id', [$adminDestinations, 'destroy']);

$article = new ArticleController();
$router->get('/api/admin/destinations/:id/article', [$article, 'show']);
$router->put('/api/admin/destinations/:id/article', [$article, 'save']);

$router->put('/api/admin/trips/:id/cover', [$adminTrips, 'setCover']);

// --- Media library (admin + CSRF, Phase: media pipeline) ---
$photos = new PhotoController();
$router->post('/api/admin/photos/upload', [$photos, 'upload']);
$router->get('/api/admin/photos', [$photos, 'index']);
$router->get('/api/admin/photos/:id', [$photos, 'show']);
$router->put('/api/admin/photos/:id', [$photos, 'update']);
$router->delete('/api/admin/photos/:id', [$photos, 'destroy']);

// --- Comment moderation (admin + CSRF) ---
$adminComments = new CommentController();
$router->get('/api/admin/comments', [$adminComments, 'index']);
$router->post('/api/admin/comments/:id/reply', [$adminComments, 'reply']);
$router->put('/api/admin/comments/:id', [$adminComments, 'update']);
$router->delete('/api/admin/comments/:id', [$adminComments, 'destroy']);

$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
