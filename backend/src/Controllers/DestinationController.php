<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use App\Http\Request;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\DestinationRepository;
use App\Repositories\TripRepository;
use App\Support\Slug;
use App\Validation\Validator;
use Throwable;

/** Admin destination management (plan §10.3, §14.3). Admin + CSRF on every write. */
final class DestinationController
{
    private const STATUSES = ['planned', 'visited', 'current', 'cancelled', 'hidden'];

    private AuthMiddleware $guard;
    private DestinationRepository $destinations;
    private TripRepository $trips;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->destinations = new DestinationRepository();
        $this->trips = new TripRepository();
    }

    /** @param array<string,string> $params  (trip id) */
    public function forTrip(array $params): void
    {
        $this->guard->requireAdmin();
        $tripId = (int) $params['id'];
        if ($this->trips->find($tripId) === null) {
            Response::error('Trip not found.', 404);
            return;
        }
        Response::json(['destinations' => $this->destinations->forTrip($tripId)]);
    }

    /** @param array<string,string> $params */
    public function show(array $params): void
    {
        $this->guard->requireAdmin();
        $destination = $this->destinations->find((int) $params['id']);
        if ($destination === null) {
            Response::error('Destination not found.', 404);
            return;
        }
        Response::json(['destination' => $destination]);
    }

    public function store(): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $data = Request::json();
        $tripId = (int) ($data['trip_id'] ?? 0);
        if ($this->trips->find($tripId) === null) {
            Response::error('Trip not found.', 404);
            return;
        }
        if (($errors = $this->validate($data)) !== null) {
            Response::json(['errors' => $errors], 422);
            return;
        }
        $payload = $this->normalize($data, $tripId, null);
        $payload['slug'] = $this->uniqueSlug($tripId, $payload['slug'] !== '' ? $payload['slug'] : $payload['title'], null);
        $payload['sort_order'] = $this->destinations->maxSortOrder($tripId) + 1;
        $id = $this->destinations->create($payload);
        Response::json(['destination' => $this->destinations->find($id)], 201);
    }

    /** @param array<string,string> $params */
    public function update(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $existing = $this->destinations->find((int) $params['id']);
        if ($existing === null) {
            Response::error('Destination not found.', 404);
            return;
        }
        $data = Request::json();
        if (($errors = $this->validate($data)) !== null) {
            Response::json(['errors' => $errors], 422);
            return;
        }
        $tripId = (int) $existing['trip_id'];
        $id = (int) $existing['id'];
        $payload = $this->normalize($data, $tripId, $existing);
        $payload['slug'] = $this->uniqueSlug($tripId, $payload['slug'] !== '' ? $payload['slug'] : $payload['title'], $id);
        $payload['sort_order'] = (int) $existing['sort_order'];
        $this->destinations->update($id, $payload);
        Response::json(['destination' => $this->destinations->find($id)]);
    }

    /** @param array<string,string> $params */
    public function destroy(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $id = (int) $params['id'];
        if ($this->destinations->find($id) === null) {
            Response::error('Destination not found.', 404);
            return;
        }
        $this->destinations->delete($id);
        Response::json(['deleted' => true]);
    }

    /** Reorder a trip's route: body { trip_id, ordered_ids: number[] }. */
    public function reorder(): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $data = Request::json();
        $tripId = (int) ($data['trip_id'] ?? 0);
        $ids = $data['ordered_ids'] ?? null;
        if ($this->trips->find($tripId) === null) {
            Response::error('Trip not found.', 404);
            return;
        }
        if (!is_array($ids)) {
            Response::error('ordered_ids must be an array.', 422);
            return;
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            foreach (array_values($ids) as $index => $id) {
                $this->destinations->setSortOrder((int) $id, $tripId, $index);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        Response::json(['destinations' => $this->destinations->forTrip($tripId)]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,string>|null
     */
    private function validate(array $data): ?array
    {
        $v = new Validator($data);
        $v->required('title')->stringMax('title', 180)
            ->stringMax('slug', 180)->stringMax('country', 120)->stringMax('excerpt', 500)
            ->in('status', self::STATUSES)
            ->dateOrNull('arrival_date')->dateOrNull('departure_date')
            ->floatRange('latitude', -90, 90)->floatRange('longitude', -180, 180);
        return $v->fails() ? $v->errors() : null;
    }

    /**
     * @param array<string,mixed> $data
     * @param array<string,mixed>|null $existing
     * @return array<string,mixed>
     */
    private function normalize(array $data, int $tripId, ?array $existing): array
    {
        $status = ($data['status'] ?? '') ?: 'planned';

        // published_at is stamped on the first transition to visited/current and
        // never overwritten — this is what "current = most recently published" keys on (PLAN_REVIEW B2).
        $publishedAt = $existing['published_at'] ?? null;
        if (in_array($status, ['visited', 'current'], true) && ($publishedAt === null || $publishedAt === '')) {
            $publishedAt = date('Y-m-d H:i:s');
        }

        return [
            'trip_id' => $tripId,
            'title' => trim((string) ($data['title'] ?? '')),
            'slug' => trim((string) ($data['slug'] ?? '')),
            'country' => $this->nullableStr($data['country'] ?? null),
            'latitude' => $this->nullableNum($data['latitude'] ?? null),
            'longitude' => $this->nullableNum($data['longitude'] ?? null),
            'arrival_date' => $this->nullableStr($data['arrival_date'] ?? null),
            'departure_date' => $this->nullableStr($data['departure_date'] ?? null),
            'excerpt' => $this->nullableStr($data['excerpt'] ?? null),
            'status' => $status,
            'published_at' => $publishedAt,
        ];
    }

    private function uniqueSlug(int $tripId, string $base, ?int $exceptId): string
    {
        $slug = Slug::make($base);
        $candidate = $slug;
        $i = 2;
        while ($this->destinations->slugExistsInTrip($tripId, $candidate, $exceptId)) {
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

    private function nullableNum(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        return is_numeric($value) ? (string) $value : null;
    }
}
