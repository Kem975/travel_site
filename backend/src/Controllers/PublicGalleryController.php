<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\PhotoRepository;
use App\Repositories\SettingsRepository;
use App\Support\PhotoPresenter;

/** Global gallery of published photos with filters (plan §6.5). */
final class PublicGalleryController
{
    private AuthMiddleware $guard;
    private PhotoRepository $photos;
    private SettingsRepository $settings;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->photos = new PhotoRepository();
        $this->settings = new SettingsRepository();
    }

    public function index(): void
    {
        $this->guard->requireVisitor();
        $includePlanned = $this->settings->get('future_destinations_visible') === '1';

        $filters = [
            'trip' => $this->str($_GET['trip'] ?? null),
            'destination' => $this->str($_GET['destination'] ?? null),
            'category' => $this->str($_GET['category'] ?? null),
        ];

        $rows = $this->photos->publicGallery($filters, $includePlanned);
        Response::json([
            'photos' => array_map(static fn (array $r) => PhotoPresenter::present($r), $rows),
            'filters' => $this->photos->galleryFilters($includePlanned),
        ]);
    }

    private function str(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $string = trim((string) $value);
        return $string === '' ? null : $string;
    }
}
