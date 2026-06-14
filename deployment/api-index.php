<?php

declare(strict_types=1);

// Production API entry point — uploaded as voyage/api/index.php.
// The real front controller and all app code live OUTSIDE the web root, in the
// sibling ../../voyage-private folder, so source and secrets are never served.
// .htaccess routes every /api/* request here; this is the only PHP in the docroot
// besides the one-time setup.php.
require __DIR__ . '/../../voyage-private/public/index.php';
