<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\PhotoRepository;
use App\Support\HtmlSanitizer;

/**
 * Validates + normalizes the typed block list (DECISIONS D6). TipTap owns only the
 * `richText` block's html; image/gallery blocks reference stable photo IDs.
 * `map` blocks arrive with the globe phase.
 *
 * `columns` holds two other blocks side by side. It is the only block with
 * children, and it may not hold another `columns`: one level, enforced here and
 * mirrored in the TypeScript model, where ColumnBlock is drawn from the leaves so
 * the nesting cannot even be expressed.
 */
final class ArticleBlocks
{
    /** Blocks that hold content rather than other blocks. */
    public const LEAF_TYPES = ['richText', 'image', 'gallery', 'video', 'quote', 'practicalInfo', 'divider'];
    public const TYPES = [...self::LEAF_TYPES, 'columns'];
    /** What a column may hold: no nesting, and no divider across half a page. */
    private const COLUMN_TYPES = ['richText', 'image', 'gallery', 'video', 'quote', 'practicalInfo'];

    // Presentation of a text block is stored beside its html rather than inside it:
    // the sanitizer strips every attribute, so alignment written into the markup
    // would not survive a save — and keeping it out means no attribute allowlist.
    private const ALIGNS = ['left', 'center'];
    private const SIZES = ['normal', 'small'];
    private const IMAGE_LAYOUTS = ['normal', 'wide', 'fullBleed'];
    private const GALLERY_LAYOUTS = ['grid', 'masonry', 'carousel'];
    // Only an id is ever stored: it lands in an iframe src, so it must not be free text.
    private const YOUTUBE_ID = '/^[A-Za-z0-9_-]{11}$/';

    /** How each type names itself in an error, so messages read as before. */
    private const LABELS = [
        'richText' => 'Text',
        'image' => 'Image',
        'gallery' => 'Gallery',
        'video' => 'Video',
        'quote' => 'Quote',
        'practicalInfo' => 'Practical info',
        'divider' => 'Divider',
        'columns' => 'Columns',
    ];

    /**
     * @param array<int,mixed> $blocks
     * @return array{0:list<array{type:string,content:mixed}>,1:list<string>} [normalized, errors]
     */
    public static function normalize(array $blocks, PhotoRepository $photos): array
    {
        $out = [];
        $errors = [];

        foreach ($blocks as $index => $block) {
            [$normalized, $blockErrors] = self::one($block, (string) ($index + 1), $photos, true);
            foreach ($blockErrors as $message) {
                $errors[] = $message;
            }
            if ($normalized !== null) {
                $out[] = $normalized;
            }
        }

        return [$out, $errors];
    }

    /**
     * One block, which may be a top-level block or one side of a `columns`.
     *
     * `$position` reads as "3" at the top level and "3 (left)" inside a column, so
     * an error still points at something the editor can be scrolled to.
     *
     * Returning null without an error is how an empty text block is dropped
     * silently; null *with* an error is a block the author has to fix.
     *
     * @return array{0:array{type:string,content:mixed}|null,1:list<string>}
     */
    private static function one(mixed $block, string $position, PhotoRepository $photos, bool $allowColumns): array
    {
        if (!is_array($block) || !isset($block['type']) || !is_string($block['type'])) {
            return [null, ["Block {$position}: malformed."]];
        }
        $type = $block['type'];
        $content = is_array($block['content'] ?? null) ? $block['content'] : [];
        $label = self::LABELS[$type] ?? 'Block';
        $where = "{$label} block {$position}";

        switch ($type) {
            case 'richText':
                $html = HtmlSanitizer::clean(is_string($content['html'] ?? null) ? $content['html'] : '');
                if ($html === '') {
                    return [null, []]; // drop empty paragraphs silently
                }
                return [['type' => 'richText', 'content' => [
                    'html' => $html,
                    'align' => in_array($content['align'] ?? '', self::ALIGNS, true) ? $content['align'] : 'left',
                    'size' => in_array($content['size'] ?? '', self::SIZES, true) ? $content['size'] : 'normal',
                ]], []];

            case 'quote':
                $text = trim((string) ($content['text'] ?? ''));
                if ($text === '') {
                    return [null, ["{$where}: text is required."]];
                }
                $attribution = trim((string) ($content['attribution'] ?? ''));
                return [['type' => 'quote', 'content' => [
                    'text' => mb_substr($text, 0, 1000),
                    'attribution' => $attribution === '' ? null : mb_substr($attribution, 0, 200),
                ]], []];

            case 'divider':
                return [['type' => 'divider', 'content' => new \stdClass()], []];

            case 'image':
                $photoId = (int) ($content['photoId'] ?? 0);
                if ($photoId <= 0 || $photos->find($photoId) === null) {
                    return [null, ["{$where}: photo not found."]];
                }
                $caption = trim((string) ($content['caption'] ?? ''));
                return [['type' => 'image', 'content' => [
                    'photoId' => $photoId,
                    'layout' => in_array($content['layout'] ?? '', self::IMAGE_LAYOUTS, true) ? $content['layout'] : 'normal',
                    'caption' => $caption === '' ? null : mb_substr($caption, 0, 500),
                ]], []];

            case 'gallery':
                $ids = is_array($content['photoIds'] ?? null)
                    ? array_values(array_unique(array_map('intval', $content['photoIds'])))
                    : [];
                $ids = array_values(array_filter($ids, static fn (int $id): bool => $id > 0 && $photos->find($id) !== null));
                if ($ids === []) {
                    return [null, ["{$where}: add at least one photo."]];
                }
                return [['type' => 'gallery', 'content' => [
                    'photoIds' => $ids,
                    'layout' => in_array($content['layout'] ?? '', self::GALLERY_LAYOUTS, true) ? $content['layout'] : 'grid',
                ]], []];

            case 'video':
                $videoId = trim((string) ($content['videoId'] ?? ''));
                if (preg_match(self::YOUTUBE_ID, $videoId) !== 1) {
                    return [null, ["{$where}: invalid YouTube video."]];
                }
                $caption = trim((string) ($content['caption'] ?? ''));
                return [['type' => 'video', 'content' => [
                    'videoId' => $videoId,
                    'caption' => $caption === '' ? null : mb_substr($caption, 0, 500),
                ]], []];

            case 'practicalInfo':
                $items = [];
                foreach (is_array($content['items'] ?? null) ? $content['items'] : [] as $item) {
                    $itemLabel = trim((string) ($item['label'] ?? ''));
                    $value = trim((string) ($item['value'] ?? ''));
                    if ($itemLabel !== '' || $value !== '') {
                        $items[] = ['label' => mb_substr($itemLabel, 0, 120), 'value' => mb_substr($value, 0, 500)];
                    }
                }
                if ($items === []) {
                    return [null, ["{$where}: add at least one item."]];
                }
                return [['type' => 'practicalInfo', 'content' => ['items' => $items]], []];

            case 'columns':
                if (!$allowColumns) {
                    return [null, ["{$where}: columns cannot be nested."]];
                }
                $sides = [];
                $errors = [];
                foreach (['left', 'right'] as $side) {
                    $child = $content[$side] ?? null;
                    $childType = is_array($child) ? ($child['type'] ?? null) : null;
                    if (is_string($childType) && !in_array($childType, self::COLUMN_TYPES, true)) {
                        $errors[] = "{$where} ({$side}): '{$childType}' cannot go in a column.";
                        continue;
                    }
                    [$normalized, $childErrors] = self::one($child, "{$position} ({$side})", $photos, false);
                    foreach ($childErrors as $message) {
                        $errors[] = $message;
                    }
                    // A side that normalized to nothing — an empty text block — is
                    // still a hole in the row, so it is reported rather than dropped.
                    if ($normalized === null) {
                        if ($childErrors === []) {
                            $errors[] = "{$where} ({$side}): this side is empty.";
                        }
                        continue;
                    }
                    $sides[$side] = $normalized;
                }
                if (count($sides) !== 2) {
                    return [null, $errors];
                }
                return [['type' => 'columns', 'content' => ['left' => $sides['left'], 'right' => $sides['right']]], $errors];

            default:
                return [null, ["Block {$position}: unknown type '{$type}'."]];
        }
    }

    /**
     * Every photo the blocks point at, columns included.
     *
     * Missing a nested one would be silent and would only show up much later: a
     * photo chosen inside a column would keep destination_id NULL and never reach
     * the public gallery, which is the bug ArticleRepository::adoptPhotos exists
     * to prevent.
     *
     * @param list<array{type:string,content:mixed}> $blocks
     * @return list<int>
     */
    public static function referencedPhotoIds(array $blocks): array
    {
        $ids = [];
        foreach ($blocks as $block) {
            $content = $block['content'];
            if (!is_array($content)) {
                continue;
            }
            if ($block['type'] === 'image' && isset($content['photoId'])) {
                $ids[] = (int) $content['photoId'];
            }
            if ($block['type'] === 'gallery' && is_array($content['photoIds'] ?? null)) {
                foreach ($content['photoIds'] as $id) {
                    $ids[] = (int) $id;
                }
            }
            if ($block['type'] === 'columns') {
                $children = array_values(array_filter(
                    [$content['left'] ?? null, $content['right'] ?? null],
                    static fn (mixed $c): bool => is_array($c) && isset($c['type']),
                ));
                /** @var list<array{type:string,content:mixed}> $children */
                foreach (self::referencedPhotoIds($children) as $id) {
                    $ids[] = $id;
                }
            }
        }
        return array_values(array_unique($ids));
    }
}
