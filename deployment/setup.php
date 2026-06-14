<?php

/**
 * ONE-TIME PRODUCTION SETUP — DELETE THIS FILE IMMEDIATELY AFTER USE.
 *
 * OVH shared hosting has no command line, so this replaces the CLI migrate.php /
 * console.php for first-run setup. It (1) runs database migrations, (2) creates
 * the first admin account, and (3) sets the shared visitor (trip) password.
 *
 * Uploaded as voyage/setup.php. Gated by SETUP_TOKEN (in voyage-private/.env):
 *   https://voyage.kemen.fr/setup.php?token=THE_TOKEN
 * Fill the form, submit, then DELETE this file from the server.
 */

declare(strict_types=1);

use App\Config;
use App\Database;
use App\Repositories\SettingsRepository;
use App\Repositories\UserRepository;

require __DIR__ . '/../voyage-private/bootstrap.php';

header('Content-Type: text/html; charset=utf-8');

$expected = Config::get('SETUP_TOKEN');
$given = (string) ($_REQUEST['token'] ?? '');
if ($expected === null || $expected === '' || !hash_equals($expected, $given)) {
    http_response_code(403);
    echo 'Forbidden. Append ?token=… (the SETUP_TOKEN from voyage-private/.env).';
    exit;
}

/** Apply backend/migrations/*.sql once each (mirrors migrate.php). */
function runMigrations(): array
{
    $pdo = Database::connection();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) NOT NULL PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $applied = array_flip($pdo->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));
    $files = glob(__DIR__ . '/../voyage-private/migrations/*.sql') ?: [];
    sort($files);
    $ran = [];
    foreach ($files as $file) {
        $version = basename($file);
        if (isset($applied[$version])) {
            continue;
        }
        $sql = (string) file_get_contents($file);
        $statements = array_filter(
            array_map('trim', explode(";\n", $sql . "\n")),
            static fn (string $s): bool => $s !== '',
        );
        foreach ($statements as $statement) {
            $pdo->exec($statement);
        }
        $pdo->prepare('INSERT INTO schema_migrations (version) VALUES (?)')->execute([$version]);
        $ran[] = $version;
    }
    return $ran;
}

$done = false;
$messages = [];
$error = null;

// If an admin already exists, setup has run — show the delete reminder, don't re-seed.
$adminExists = false;
try {
    $adminExists = (bool) Database::connection()
        ->query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1")
        ->fetchColumn();
} catch (Throwable $e) {
    // users table not created yet — first run.
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$adminExists) {
    $email = trim((string) ($_POST['email'] ?? ''));
    $name = trim((string) ($_POST['name'] ?? ''));
    $adminPw = (string) ($_POST['admin_password'] ?? '');
    $tripPw = (string) ($_POST['trip_password'] ?? '');
    try {
        if ($email === '' || $name === '' || $adminPw === '' || $tripPw === '') {
            throw new RuntimeException('All four fields are required.');
        }
        $ran = runMigrations();
        $messages[] = $ran ? ('Migrations applied: ' . implode(', ', $ran)) : 'Migrations already up to date.';

        $users = new UserRepository();
        if ($users->findByEmail($email) === null) {
            $id = $users->create($email, $name, password_hash($adminPw, PASSWORD_DEFAULT), 'admin');
            $messages[] = "Admin account created: {$email} (#{$id}).";
        } else {
            $messages[] = "Admin {$email} already existed — left unchanged.";
        }

        (new SettingsRepository())->set('trip_password_hash', password_hash($tripPw, PASSWORD_DEFAULT));
        $messages[] = 'Visitor (trip) password set.';
        $done = true;
    } catch (Throwable $e) {
        $error = $e->getMessage();
    }
}
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Our Journey — first-run setup</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 34rem; margin: 3rem auto; padding: 0 1rem; color: #1f2a2e; line-height: 1.5; }
  h1 { font-size: 1.5rem; }
  label { display: block; margin: 1rem 0 .25rem; font-weight: 600; }
  input { width: 100%; padding: .55rem; font-size: 1rem; box-sizing: border-box; border: 1px solid #cbb; border-radius: .4rem; }
  button { margin-top: 1.5rem; padding: .6rem 1.4rem; font-size: 1rem; cursor: pointer; border-radius: .4rem; border: 0; background: #294c5a; color: #fff; }
  .ok { color: #1d6f42; } .err { color: #b00020; }
  .box { background: #f3efe4; padding: 1rem 1.25rem; border-radius: .6rem; }
  small { color: #6f665a; }
</style>
</head>
<body>
<h1>Our Journey — first-run setup</h1>

<?php if ($error !== null): ?>
  <p class="err"><strong>Error:</strong> <?= htmlspecialchars($error) ?></p>
<?php endif; ?>

<?php if ($done): ?>
  <div class="box">
    <?php foreach ($messages as $m): ?><p class="ok">✓ <?= htmlspecialchars($m) ?></p><?php endforeach; ?>
    <p><strong>Now delete this file (<code>setup.php</code>) from the server.</strong> Then open <a href="/">your site</a>.</p>
  </div>
<?php elseif ($adminExists): ?>
  <div class="box">
    <p>An admin account already exists — setup is complete.</p>
    <p><strong>Please delete this file (<code>setup.php</code>) from the server now.</strong></p>
  </div>
<?php else: ?>
  <p>Run this once to initialise the database and create your accounts, then delete the file.</p>
  <form method="post">
    <input type="hidden" name="token" value="<?= htmlspecialchars($given) ?>">
    <label>Admin email</label>
    <input name="email" type="email" autocomplete="off" required>
    <label>Admin display name</label>
    <input name="name" autocomplete="off" required>
    <label>Admin password</label>
    <input name="admin_password" type="password" autocomplete="new-password" required>
    <label>Visitor (trip) password <small>— the shared password you give guests</small></label>
    <input name="trip_password" type="password" autocomplete="new-password" required>
    <button type="submit">Run setup</button>
  </form>
<?php endif; ?>
</body>
</html>
