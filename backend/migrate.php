<?php

declare(strict_types=1);

use App\Database;

require __DIR__ . '/bootstrap.php';

// Applies backend/migrations/*.sql in filename order, once each, tracked in
// schema_migrations. Run: php backend/migrate.php
$dir = __DIR__ . '/migrations';
$pdo = Database::connection();

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

/** @var array<string,bool> $applied */
$applied = array_flip($pdo->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));

$files = glob($dir . '/*.sql') ?: [];
sort($files);

$ran = 0;
foreach ($files as $file) {
    $version = basename($file);
    if (isset($applied[$version])) {
        continue;
    }

    echo "Applying {$version}... ";
    $sql = (string) file_get_contents($file);

    // Split on statement terminators (`;` at end of line). Our DDL has no
    // semicolons inside strings, so this is safe and avoids multi-statement quirks.
    $statements = array_filter(
        array_map('trim', explode(";\n", $sql . "\n")),
        static fn (string $s): bool => $s !== '',
    );

    // No transaction wrapper: MySQL implicitly commits on every DDL statement,
    // so a transaction here gives false safety and breaks commit(). Keep each
    // migration small; on failure we fix forward with the next migration.
    try {
        foreach ($statements as $statement) {
            $pdo->exec($statement);
        }
        $pdo->prepare('INSERT INTO schema_migrations (version) VALUES (?)')->execute([$version]);
    } catch (Throwable $e) {
        echo "FAILED\n";
        fwrite(STDERR, $e->getMessage() . "\n");
        exit(1);
    }

    echo "done\n";
    $ran++;
}

echo $ran === 0 ? "No new migrations.\n" : "Applied {$ran} migration(s).\n";
