<?php

declare(strict_types=1);

use App\Repositories\PhotoRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\UserRepository;
use App\Support\Storage;

require __DIR__ . '/bootstrap.php';

/**
 * Small admin CLI. Used in production to set the shared trip password and to
 * create the first admin account (passwords never live in migrations/git).
 *
 *   php backend/console.php visitor:set-password "<password>"
 *   php backend/console.php admin:create <email> "<display name>" "<password>"
 */
$args = array_slice($argv, 1);
$command = $args[0] ?? '';

switch ($command) {
    case 'visitor:set-password':
        $password = $args[1] ?? '';
        if ($password === '') {
            fwrite(STDERR, "Usage: console.php visitor:set-password \"<password>\"\n");
            exit(1);
        }
        (new SettingsRepository())->set('trip_password_hash', password_hash($password, PASSWORD_DEFAULT));
        echo "Visitor trip password updated.\n";
        break;

    case 'admin:create':
        $email = $args[1] ?? '';
        $name = $args[2] ?? '';
        $password = $args[3] ?? '';
        if ($email === '' || $name === '' || $password === '') {
            fwrite(STDERR, "Usage: console.php admin:create <email> \"<display name>\" \"<password>\"\n");
            exit(1);
        }
        $users = new UserRepository();
        if ($users->findByEmail($email) !== null) {
            fwrite(STDERR, "A user with that email already exists.\n");
            exit(1);
        }
        $id = $users->create($email, $name, password_hash($password, PASSWORD_DEFAULT), 'admin');
        echo "Admin user #{$id} created: {$email}\n";
        break;

    case 'photos:gc':
        $delete = in_array('--delete', $args, true);
        $expected = [];
        foreach ((new PhotoRepository())->allForGc() as $photo) {
            $variants = json_decode((string) $photo['variants'], true);
            if (!is_array($variants)) {
                continue;
            }
            foreach ($variants as $w) {
                $rel = trim((string) $photo['storage_path'], '/') . '/' . $photo['filename'] . '-' . (int) $w . '.webp';
                $expected[Storage::absolute($rel)] = true;
            }
        }

        $root = Storage::dir() . '/photos';
        $orphans = [];
        if (is_dir($root)) {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
            );
            foreach ($iterator as $file) {
                $path = $file->getPathname();
                if ($file->isFile() && str_ends_with($path, '.webp') && !isset($expected[$path])) {
                    $orphans[] = $path;
                }
            }
        }

        if ($orphans === []) {
            echo "No orphan files.\n";
            break;
        }
        foreach ($orphans as $orphan) {
            if ($delete) {
                @unlink($orphan);
            }
            echo ($delete ? 'deleted: ' : 'orphan:  ') . $orphan . "\n";
        }
        echo ($delete ? 'Deleted ' : 'Found ') . count($orphans) . ' orphan file(s)'
            . ($delete ? '' : ' — run with --delete to remove') . ".\n";
        break;

    default:
        echo "Our Journey — console\n";
        echo "  php backend/console.php visitor:set-password \"<password>\"\n";
        echo "  php backend/console.php admin:create <email> \"<display name>\" \"<password>\"\n";
        echo "  php backend/console.php photos:gc [--delete]\n";
        exit($command === '' ? 0 : 1);
}
