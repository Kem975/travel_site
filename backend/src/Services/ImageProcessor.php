<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

/**
 * Generates responsive WebP variants with GD (PLAN_REVIEW D2: WebP-only for MVP).
 * The client already downsizes to ≤2400px before upload, so this stays cheap.
 */
final class ImageProcessor
{
    private const SIZES = [480, 960, 1600, 2400];
    private const QUALITY = 82;

    /**
     * @return array{width:int,height:int,variants:list<int>}
     */
    public function makeWebpVariants(string $sourcePath, string $destDir, string $baseName): array
    {
        $data = file_get_contents($sourcePath);
        if ($data === false) {
            throw new RuntimeException('Cannot read uploaded file.');
        }
        $src = @imagecreatefromstring($data);
        if ($src === false) {
            throw new RuntimeException('Unsupported or corrupt image.');
        }

        $origW = imagesx($src);
        $origH = imagesy($src);

        // Every width in SIZES smaller than the source, plus the source width capped at 2400.
        $widths = array_values(array_filter(self::SIZES, static fn (int $w): bool => $w < $origW));
        $widths[] = min($origW, 2400);
        $widths = array_values(array_unique($widths));
        sort($widths);

        if (!is_dir($destDir) && !mkdir($destDir, 0775, true) && !is_dir($destDir)) {
            imagedestroy($src);
            throw new RuntimeException('Cannot create destination directory.');
        }

        foreach ($widths as $w) {
            $h = (int) max(1, round($origH * ($w / $origW)));
            $dst = imagecreatetruecolor($w, $h);
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $w, $h, $origW, $origH);

            $path = $destDir . '/' . $baseName . '-' . $w . '.webp';
            if (!imagewebp($dst, $path, self::QUALITY)) {
                imagedestroy($dst);
                imagedestroy($src);
                throw new RuntimeException('WebP encoding failed.');
            }
            imagedestroy($dst);
        }

        imagedestroy($src);

        return ['width' => $origW, 'height' => $origH, 'variants' => $widths];
    }
}
