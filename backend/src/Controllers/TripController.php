<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\PhotoRepository;
use App\Repositories\TripRepository;
use App\Support\Slug;
use App\Validation\Validator;

/** Admin trip management (plan §10.2, §14.2). All actions require admin + CSRF. */
final class TripController
{
    private const STATUSES = ['draft', 'published', 'archived'];
    private const VISIBILITIES = ['private', 'password_protected', 'public'];

    private AuthMiddleware $guard;
    private TripRepository $trips;
    private PhotoRepository $photos;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->trips = new TripRepository();
        $this->photos = new PhotoRepository();
    }

    /** @param array<string,string> $params */
    public function setCover(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $id = (int) $params['id'];
        if ($this->trips->find($id) === null) {
            Response::error('Trip not found.', 404);
            return;
        }
        $data = Request::json();
        $photoId = isset($data['photo_id']) && $data['photo_id'] !== null && $data['photo_id'] !== ''
            ? (int) $data['photo_id']
            : null;
        if ($photoId !== null && $this->photos->find($photoId) === null) {
            Response::error('Photo not found.', 422);
            return;
        }
        $this->trips->setCover($id, $photoId);
        Response::json(['trip' => $this->trips->find($id)]);
    }

    public function index(): void
    {
        $this->guard->requireAdmin();
        Response::json(['trips' => $this->trips->all()]);
    }

    /** @param array<string,string> $params */
    public function show(array $params): void
    {
        $this->guard->requireAdmin();
        $trip = $this->trips->find((int) $params['id']);
        if ($trip === null) {
            Response::error('Trip not found.', 404);
            return;
        }
        Response::json(['trip' => $trip]);
    }

    public function store(): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $data = Request::json();
        if (($errors = $this->validate($data)) !== null) {
            Response::json(['errors' => $errors], 422);
            return;
        }
        $payload = $this->normalize($data);
        $payload['slug'] = $this->uniqueSlug($payload['slug'] !== '' ? $payload['slug'] : $payload['title'], null);
        $id = $this->trips->create($payload);
        Response::json(['trip' => $this->trips->find($id)], 201);
    }

    /** @param array<string,string> $params */
    public function update(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $id = (int) $params['id'];
        if ($this->trips->find($id) === null) {
            Response::error('Trip not found.', 404);
            return;
        }
        $data = Request::json();
        if (($errors = $this->validate($data)) !== null) {
            Response::json(['errors' => $errors], 422);
            return;
        }
        $payload = $this->normalize($data);
        $payload['slug'] = $this->uniqueSlug($payload['slug'] !== '' ? $payload['slug'] : $payload['title'], $id);
        $this->trips->update($id, $payload);
        Response::json(['trip' => $this->trips->find($id)]);
    }

    /** @param array<string,string> $params */
    public function destroy(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $id = (int) $params['id'];
        if ($this->trips->find($id) === null) {
            Response::error('Trip not found.', 404);
            return;
        }
        $this->trips->delete($id);
        Response::json(['deleted' => true]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,string>|null
     */
    private function validate(array $data): ?array
    {
        $v = new Validator($data);
        $v->required('title')->stringMax('title', 180)
            ->stringMax('slug', 180)
            ->in('status', self::STATUSES)
            ->in('visibility', self::VISIBILITIES)
            ->dateOrNull('start_date')->dateOrNull('end_date');
        return $v->fails() ? $v->errors() : null;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    private function normalize(array $data): array
    {
        return [
            'title' => trim((string) ($data['title'] ?? '')),
            'slug' => trim((string) ($data['slug'] ?? '')),
            'description' => $this->nullableStr($data['description'] ?? null),
            'start_date' => $this->nullableStr($data['start_date'] ?? null),
            'end_date' => $this->nullableStr($data['end_date'] ?? null),
            'status' => ($data['status'] ?? '') ?: 'draft',
            'visibility' => ($data['visibility'] ?? '') ?: 'password_protected',
        ];
    }

    private function uniqueSlug(string $base, ?int $exceptId): string
    {
        $slug = Slug::make($base);
        $candidate = $slug;
        $i = 2;
        while ($this->trips->slugExists($candidate, $exceptId)) {
            $candidate = $slug . '-' . $i++;
        }
        return $candidate;
    }

    private function nullableStr(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $string = trim((string) $value);
        return $string === '' ? null : $string;
    }
}
