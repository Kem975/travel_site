<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Turns a photos row into an API shape with ready-to-use responsive URLs.
 * Variant files live at /uploads/{storage_path}/{filename}-{width}.webp.
 */
final class PhotoPresenter
{
    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function present(array $row): array
    {
        $variants = self::variants($row['variants'] ?? null);
        $base = '/uploads/' . trim((string) $row['storage_path'], '/') . '/' . $row['filename'];

        $urls = [];
        $srcset = [];
        foreach ($variants as $w) {
            $url = "{$base}-{$w}.webp";
            $urls[(string) $w] = $url;
            $srcset[] = "{$url} {$w}w";
        }

        return [
            'id' => (int) $row['id'],
            'destination_id' => $row['destination_id'] !== null ? (int) $row['destination_id'] : null,
            'trip_id' => $row['trip_id'] !== null ? (int) $row['trip_id'] : null,
            'width' => (int) $row['width'],
            'height' => (int) $row['height'],
            'alt_text' => $row['alt_text'],
            'caption' => $row['caption'],
            'category' => $row['category'],
            'is_featured' => (bool) $row['is_featured'],
            'original_filename' => $row['original_filename'] ?? null,
            'urls' => $urls,
            'srcset' => implode(', ', $srcset),
            'thumb' => $variants !== [] ? $urls[(string) min($variants)] : null,
            'full' => $variants !== [] ? $urls[(string) max($variants)] : null,
            'created_at' => $row['created_at'] ?? null,
        ];
    }

    /**
     * @param mixed $raw
     * @return list<int>
     */
    private static function variants(mixed $raw): array
    {
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($raw)) {
            return [];
        }
        $widths = array_map('intval', $raw);
        sort($widths);
        return array_values($widths);
    }
}
