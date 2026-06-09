<?php

declare(strict_types=1);

use App\Repositories\SettingsRepository;
use App\Repositories\UserRepository;

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

    default:
        echo "Our Journey — console\n";
        echo "  php backend/console.php visitor:set-password \"<password>\"\n";
        echo "  php backend/console.php admin:create <email> \"<display name>\" \"<password>\"\n";
        exit($command === '' ? 0 : 1);
}
