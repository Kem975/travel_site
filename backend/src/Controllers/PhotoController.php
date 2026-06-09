<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\DestinationRepository;
use App\Repositories\PhotoRepository;
use App\Services\ImageProcessor;
use App\Support\PhotoPresenter;
use App\Support\Storage;
use App\Validation\Validator;
use finfo;
use Throwable;

/** Media library: upload, list, edit metadata, delete (plan §8, §10.5). Admin + CSRF. */
final class PhotoController
{
    public const CATEGORIES = ['landscapes', 'cities', 'food', 'wildlife', 'portraits', 'accommodation', 'hiking'];

    private const MAX_BYTES = 15 * 1024 * 1024;
    private const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

    private AuthMiddleware $guard;
    private PhotoRepository $photos;
    private DestinationRepository $destinations;

    public function __construct()
    {
        $this->guard = new AuthMiddleware();
        $this->photos = new PhotoRepository();
        $this->destinations = new DestinationRepository();
    }

    public function upload(): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $file = $_FILES['file'] ?? null;
        if (!is_array($file)) {
            Response::error('No file uploaded.', 422);
            return;
        }
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::error('Upload failed.', 422);
            return;
        }
        $tmp = (string) ($file['tmp_name'] ?? '');
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            Response::error('Invalid upload.', 422);
            return;
        }
        if ((int) ($file['size'] ?? 0) > self::MAX_BYTES) {
            Response::error('File too large (max 15 MB).', 422);
            return;
        }

        // Trust the bytes, not the client: sniff the real MIME and decode.
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmp);
        if (!in_array($mime, self::ALLOWED_MIME, true)) {
            Response::error('Unsupported image type (JPEG, PNG or WebP only).', 422);
            return;
        }
        if (@getimagesize($tmp) === false) {
            Response::error('File is not a valid image.', 422);
            return;
        }

        $relDir = 'photos/' . date('Y/m');
        $base = bin2hex(random_bytes(16));
        try {
            $absDir = Storage::ensureSubdir($relDir);
            $meta = (new ImageProcessor())->makeWebpVariants($tmp, $absDir, $base);
        } catch (Throwable $e) {
            error_log((string) $e);
            Response::error('Could not process image.', 422);
            return;
        }

        // Optional assignment at upload time.
        $destinationId = $this->intOrNull($_POST['destination_id'] ?? null);
        $tripId = null;
        if ($destinationId !== null) {
            $destination = $this->destinations->find($destinationId);
            if ($destination === null) {
                $this->deleteVariantFiles($relDir, $base, $meta['variants']);
                Response::error('Destination not found.', 422);
                return;
            }
            $tripId = (int) $destination['trip_id'];
        }

        $id = $this->photos->create([
            'destination_id' => $destinationId,
            'trip_id' => $tripId,
            'filename' => $base,
            'storage_path' => $relDir,
            'original_filename' => isset($file['name']) ? substr((string) $file['name'], 0, 255) : null,
            'mime_type' => 'image/webp',
            'width' => $meta['width'],
            'height' => $meta['height'],
            'variants' => json_encode($meta['variants']),
            'alt_text' => $this->strOrNull($_POST['alt_text'] ?? null),
            'caption' => $this->strOrNull($_POST['caption'] ?? null),
            'category' => $this->categoryOrNull($_POST['category'] ?? null),
        ]);

        $row = $this->photos->find($id);
        Response::json(['photo' => $row !== null ? PhotoPresenter::present($row) : null], 201);
    }

    public function index(): void
    {
        $this->guard->requireAdmin();
        $rows = $this->photos->all([
            'destination_id' => $this->intOrNull($_GET['destination_id'] ?? null),
            'trip_id' => $this->intOrNull($_GET['trip_id'] ?? null),
            'unassigned' => ($_GET['unassigned'] ?? '') === '1',
            'category' => $this->strOrNull($_GET['category'] ?? null),
        ]);
        Response::json(['photos' => array_map(static fn (array $r) => PhotoPresenter::present($r), $rows)]);
    }

    /** @param array<string,string> $params */
    public function show(array $params): void
    {
        $this->guard->requireAdmin();
        $row = $this->photos->find((int) $params['id']);
        if ($row === null) {
            Response::error('Photo not found.', 404);
            return;
        }
        Response::json(['photo' => PhotoPresenter::present($row)]);
    }

    /** @param array<string,string> $params */
    public function update(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $row = $this->photos->find((int) $params['id']);
        if ($row === null) {
            Response::error('Photo not found.', 404);
            return;
        }
        $data = Request::json();

        $v = new Validator($data);
        $v->stringMax('alt_text', 300)->stringMax('caption', 500)->in('category', self::CATEGORIES);
        if ($v->fails()) {
            Response::json(['errors' => $v->errors()], 422);
            return;
        }

        $destinationId = array_key_exists('destination_id', $data)
            ? $this->intOrNull($data['destination_id'])
            : ($row['destination_id'] !== null ? (int) $row['destination_id'] : null);
        $tripId = null;
        if ($destinationId !== null) {
            $destination = $this->destinations->find($destinationId);
            if ($destination === null) {
                Response::error('Destination not found.', 422);
                return;
            }
            $tripId = (int) $destination['trip_id'];
        }

        $this->photos->updateMeta((int) $row['id'], [
            'destination_id' => $destinationId,
            'trip_id' => $tripId,
            'alt_text' => $this->strOrNull($data['alt_text'] ?? $row['alt_text']),
            'caption' => $this->strOrNull($data['caption'] ?? $row['caption']),
            'category' => $this->categoryOrNull($data['category'] ?? $row['category']),
            'is_featured' => (bool) ($data['is_featured'] ?? $row['is_featured']),
        ]);

        $updated = $this->photos->find((int) $row['id']);
        Response::json(['photo' => $updated !== null ? PhotoPresenter::present($updated) : null]);
    }

    /** @param array<string,string> $params */
    public function destroy(array $params): void
    {
        $ctx = $this->guard->requireAdmin();
        $this->guard->requireCsrf($ctx);

        $row = $this->photos->find((int) $params['id']);
        if ($row === null) {
            Response::error('Photo not found.', 404);
            return;
        }
        $references = $this->photos->references((int) $row['id']);
        if ($references !== []) {
            Response::error('This photo is still in use (' . implode(', ', $references) . '). Remove it there first.', 409);
            return;
        }
        $variants = json_decode((string) $row['variants'], true);
        $this->deleteVariantFiles((string) $row['storage_path'], (string) $row['filename'], is_array($variants) ? $variants : []);
        $this->photos->delete((int) $row['id']); // cover_photo_id FKs are ON DELETE SET NULL
        Response::json(['deleted' => true]);
    }

    /** @param list<int> $variants */
    private function deleteVariantFiles(string $storagePath, string $base, array $variants): void
    {
        foreach ($variants as $w) {
            $path = Storage::absolute(trim($storagePath, '/') . '/' . $base . '-' . (int) $w . '.webp');
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }

    private function intOrNull(mixed $value): ?int
    {
        return $value === null || $value === '' ? null : (int) $value;
    }

    private function strOrNull(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $string = trim((string) $value);
        return $string === '' ? null : $string;
    }

    private function categoryOrNull(mixed $value): ?string
    {
        $string = $this->strOrNull($value);
        return $string !== null && in_array($string, self::CATEGORIES, true) ? $string : null;
    }
}
