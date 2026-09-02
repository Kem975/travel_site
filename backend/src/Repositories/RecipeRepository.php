<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Database;
use Throwable;

/**
 * Recipes and their per-language content.
 *
 * A recipe row is the identity (country, slug, cover); a translation row carries
 * the words. Reads therefore almost always join the two, and the language is a
 * parameter rather than a filter applied afterwards.
 */
final class RecipeRepository
{
    public const LANGS = ['fr', 'en'];

    private const RECIPE_COLUMNS = 'r.id, r.trip_id, r.destination_id, r.slug, r.cover_photo_id, r.sort_order';
    private const TEXT_COLUMNS = 't.id AS translation_id, t.lang, t.title, t.subtitle, t.ingredients, t.steps, '
        . 't.status, t.published_at';

    public static function lang(mixed $value): string
    {
        return in_array($value, self::LANGS, true) ? (string) $value : 'fr';
    }

    /** Admin list: every recipe with its French title, so the list is never blank. */
    /** @return list<array<string,mixed>> */
    public function all(): array
    {
        $sql = 'SELECT ' . self::RECIPE_COLUMNS . ", tr.title AS trip_title,
                       t.title, t.status,
                       (SELECT GROUP_CONCAT(lang ORDER BY lang) FROM recipe_translations WHERE recipe_id = r.id) AS langs
                FROM recipes r
                JOIN trips tr ON tr.id = r.trip_id
                LEFT JOIN recipe_translations t ON t.recipe_id = r.id AND t.lang = 'fr'
                ORDER BY r.sort_order ASC, r.id ASC";
        return Database::connection()->query($sql)->fetchAll();
    }

    /**
     * Public list in the requested language. Only published translations appear, so
     * a recipe written but not yet translated simply isn't in the English list.
     * @return list<array<string,mixed>>
     */
    public function published(string $lang): array
    {
        $sql = 'SELECT ' . self::RECIPE_COLUMNS . ', ' . self::TEXT_COLUMNS . ", tr.title AS trip_title, tr.slug AS trip_slug
                FROM recipes r
                JOIN recipe_translations t ON t.recipe_id = r.id AND t.lang = ?
                JOIN trips tr ON tr.id = r.trip_id
                WHERE t.status = 'published' AND tr.status = 'published'
                ORDER BY r.sort_order ASC, r.id ASC";
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute([$lang]);
        return $stmt->fetchAll();
    }

    /** Published recipes pinned to one stop — what that stop's page links to. */
    /** @return list<array<string,mixed>> */
    public function publishedForDestination(int $destinationId, string $lang): array
    {
        $sql = 'SELECT ' . self::RECIPE_COLUMNS . ', ' . self::TEXT_COLUMNS . "
                FROM recipes r
                JOIN recipe_translations t ON t.recipe_id = r.id AND t.lang = ?
                WHERE r.destination_id = ? AND t.status = 'published'
                ORDER BY r.sort_order ASC, r.id ASC";
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute([$lang, $destinationId]);
        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::RECIPE_COLUMNS . ' FROM recipes r WHERE r.id = ? LIMIT 1',
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed>|null */
    public function findBySlug(string $slug): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::RECIPE_COLUMNS . ' FROM recipes r WHERE r.slug = ? LIMIT 1',
        );
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string,mixed>|null */
    public function translation(int $recipeId, string $lang): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . self::TEXT_COLUMNS . ' FROM recipe_translations t WHERE t.recipe_id = ? AND t.lang = ? LIMIT 1',
        );
        $stmt->execute([$recipeId, $lang]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    /** Which languages this recipe is readable in, in LANGS order. @return list<string> */
    public function publishedLangs(int $recipeId): array
    {
        $stmt = Database::connection()->prepare(
            "SELECT lang FROM recipe_translations WHERE recipe_id = ? AND status = 'published'",
        );
        $stmt->execute([$recipeId]);
        $found = $stmt->fetchAll(\PDO::FETCH_COLUMN);
        return array_values(array_filter(self::LANGS, static fn (string $l): bool => in_array($l, $found, true)));
    }

    /** @return list<array{type:string,content:array<string,mixed>}> */
    public function blocks(int $translationId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT block_type, content_json FROM recipe_blocks WHERE translation_id = ? ORDER BY sort_order ASC, id ASC',
        );
        $stmt->execute([$translationId]);
        return array_map(static function (array $row): array {
            $content = json_decode((string) $row['content_json'], true);
            return ['type' => (string) $row['block_type'], 'content' => is_array($content) ? $content : []];
        }, $stmt->fetchAll());
    }

    public function slugExists(string $slug, ?int $exceptId = null): bool
    {
        $sql = 'SELECT 1 FROM recipes WHERE slug = ?' . ($exceptId !== null ? ' AND id <> ?' : '') . ' LIMIT 1';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($exceptId !== null ? [$slug, $exceptId] : [$slug]);
        return $stmt->fetchColumn() !== false;
    }

    public function maxSortOrder(): int
    {
        return (int) Database::connection()->query('SELECT COALESCE(MAX(sort_order), -1) FROM recipes')->fetchColumn();
    }

    /** @param array<string,mixed> $data */
    public function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO recipes (trip_id, destination_id, slug, sort_order)
             VALUES (:trip_id, :destination_id, :slug, :sort_order)',
        );
        $stmt->execute([
            'trip_id' => $data['trip_id'],
            'destination_id' => $data['destination_id'],
            'slug' => $data['slug'],
            'sort_order' => $data['sort_order'],
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    /** @param array<string,mixed> $data */
    public function update(int $id, array $data): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE recipes SET trip_id = :trip_id, destination_id = :destination_id, slug = :slug WHERE id = :id',
        );
        $stmt->execute([
            'trip_id' => $data['trip_id'],
            'destination_id' => $data['destination_id'],
            'slug' => $data['slug'],
            'id' => $id,
        ]);
    }

    public function setCover(int $id, ?int $photoId): void
    {
        $stmt = Database::connection()->prepare('UPDATE recipes SET cover_photo_id = ? WHERE id = ?');
        $stmt->execute([$photoId, $id]);
    }

    public function delete(int $id): void
    {
        Database::connection()->prepare('DELETE FROM recipes WHERE id = ?')->execute([$id]);
    }

    /**
     * Upsert one language's content and replace its blocks, in one transaction —
     * a half-written translation would show up on the public list.
     *
     * @param array<string,mixed> $meta
     * @param list<array{type:string,content:mixed}> $blocks
     */
    public function saveTranslation(int $recipeId, string $lang, array $meta, array $blocks): void
    {
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $find = $pdo->prepare('SELECT id FROM recipe_translations WHERE recipe_id = ? AND lang = ? FOR UPDATE');
            $find->execute([$recipeId, $lang]);
            $existing = $find->fetch();

            $params = [
                'title' => $meta['title'],
                'subtitle' => $meta['subtitle'],
                'ingredients' => json_encode($meta['ingredients'], JSON_UNESCAPED_UNICODE),
                'steps' => json_encode($meta['steps'], JSON_UNESCAPED_UNICODE),
                'status' => $meta['status'],
                'published_at' => $meta['published_at'],
            ];

            if ($existing !== false) {
                $id = (int) $existing['id'];
                $params['id'] = $id;
                $pdo->prepare(
                    'UPDATE recipe_translations SET title = :title, subtitle = :subtitle,
                     ingredients = :ingredients, steps = :steps, status = :status,
                     published_at = :published_at WHERE id = :id',
                )->execute($params);
            } else {
                $params['recipe_id'] = $recipeId;
                $params['lang'] = $lang;
                $pdo->prepare(
                    'INSERT INTO recipe_translations (recipe_id, lang, title, subtitle, ingredients, steps, status, published_at)
                     VALUES (:recipe_id, :lang, :title, :subtitle, :ingredients, :steps, :status, :published_at)',
                )->execute($params);
                $id = (int) $pdo->lastInsertId();
            }

            $pdo->prepare('DELETE FROM recipe_blocks WHERE translation_id = ?')->execute([$id]);
            $insert = $pdo->prepare(
                'INSERT INTO recipe_blocks (translation_id, block_type, content_json, sort_order) VALUES (?, ?, ?, ?)',
            );
            foreach (array_values($blocks) as $i => $block) {
                $insert->execute([
                    $id,
                    $block['type'],
                    json_encode($block['content'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    $i,
                ]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
