<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\PhotoRepository;
use App\Support\HtmlSanitizer;

/**
 * Validates + normalizes the typed block list (DECISIONS D6). TipTap owns only the
 * `richText` block's html; image/gallery blocks reference stable photo IDs.
 * `map` blocks arrive with the globe phase.
 */
final class ArticleBlocks
{
    public const TYPES = ['richText', 'image', 'gallery', 'quote', 'practicalInfo', 'divider'];
    private const IMAGE_LAYOUTS = ['normal', 'wide', 'fullBleed'];
    private const GALLERY_LAYOUTS = ['grid', 'masonry', 'carousel'];

    /**
     * @param array<int,mixed> $blocks
     * @return array{0:list<array{type:string,content:array<string,mixed>}>,1:list<string>} [normalized, errors]
     */
    public static function normalize(array $blocks, PhotoRepository $photos): array
    {
        $out = [];
        $errors = [];

        foreach ($blocks as $index => $block) {
            $position = $index + 1;
            if (!is_array($block) || !isset($block['type']) || !is_string($block['type'])) {
                $errors[] = "Block {$position}: malformed.";
                continue;
            }
            $type = $block['type'];
            $content = is_array($block['content'] ?? null) ? $block['content'] : [];

            switch ($type) {
                case 'richText':
                    $html = HtmlSanitizer::clean(is_string($content['html'] ?? null) ? $content['html'] : '');
                    if ($html === '') {
                        break; // drop empty paragraphs silently
                    }
                    $out[] = ['type' => 'richText', 'content' => ['html' => $html]];
                    break;

                case 'quote':
                    $text = trim((string) ($content['text'] ?? ''));
                    if ($text === '') {
                        $errors[] = "Quote block {$position}: text is required.";
                        break;
                    }
                    $attribution = trim((string) ($content['attribution'] ?? ''));
                    $out[] = ['type' => 'quote', 'content' => [
                        'text' => mb_substr($text, 0, 1000),
                        'attribution' => $attribution === '' ? null : mb_substr($attribution, 0, 200),
                    ]];
                    break;

                case 'divider':
                    $out[] = ['type' => 'divider', 'content' => new \stdClass()];
                    break;

                case 'image':
                    $photoId = (int) ($content['photoId'] ?? 0);
                    if ($photoId <= 0 || $photos->find($photoId) === null) {
                        $errors[] = "Image block {$position}: photo not found.";
                        break;
                    }
                    $caption = trim((string) ($content['caption'] ?? ''));
                    $out[] = ['type' => 'image', 'content' => [
                        'photoId' => $photoId,
                        'layout' => in_array($content['layout'] ?? '', self::IMAGE_LAYOUTS, true) ? $content['layout'] : 'normal',
                        'caption' => $caption === '' ? null : mb_substr($caption, 0, 500),
                    ]];
                    break;

                case 'gallery':
                    $ids = is_array($content['photoIds'] ?? null)
                        ? array_values(array_unique(array_map('intval', $content['photoIds'])))
                        : [];
                    $ids = array_values(array_filter($ids, static fn (int $id): bool => $id > 0 && $photos->find($id) !== null));
                    if ($ids === []) {
                        $errors[] = "Gallery block {$position}: add at least one photo.";
                        break;
                    }
                    $out[] = ['type' => 'gallery', 'content' => [
                        'photoIds' => $ids,
                        'layout' => in_array($content['layout'] ?? '', self::GALLERY_LAYOUTS, true) ? $content['layout'] : 'grid',
                    ]];
                    break;

                case 'practicalInfo':
                    $items = [];
                    foreach (is_array($content['items'] ?? null) ? $content['items'] : [] as $item) {
                        $label = trim((string) ($item['label'] ?? ''));
                        $value = trim((string) ($item['value'] ?? ''));
                        if ($label !== '' || $value !== '') {
                            $items[] = ['label' => mb_substr($label, 0, 120), 'value' => mb_substr($value, 0, 500)];
                        }
                    }
                    if ($items === []) {
                        $errors[] = "Practical info block {$position}: add at least one item.";
                        break;
                    }
                    $out[] = ['type' => 'practicalInfo', 'content' => ['items' => $items]];
                    break;

                default:
                    $errors[] = "Block {$position}: unknown type '{$type}'.";
            }
        }

        return [$out, $errors];
    }

    /**
     * @param list<array{type:string,content:array<string,mixed>}> $blocks
     * @return list<int>
     */
    public static function referencedPhotoIds(array $blocks): array
    {
        $ids = [];
        foreach ($blocks as $block) {
            $content = $block['content'];
            if ($block['type'] === 'image' && isset($content['photoId'])) {
                $ids[] = (int) $content['photoId'];
            }
            if ($block['type'] === 'gallery' && is_array($content['photoIds'] ?? null)) {
                foreach ($content['photoIds'] as $id) {
                    $ids[] = (int) $id;
                }
            }
        }
        return array_values(array_unique($ids));
    }
}
