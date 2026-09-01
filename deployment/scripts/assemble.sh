#!/usr/bin/env bash
#
# Assemble the FTP upload bundle in _deploy/ from the current working tree.
#
# OVH shared hosting has no SSH, so "deploying" is uploading files. This builds the
# frontend and lays the two server folders out exactly as they sit on the host —
# see deployment/README-deploy.md for the upload itself.
#
# Three things it must never do, because they'd break production:
#   - overwrite _deploy/voyage-private/.env  (the real secrets; not in git)
#   - wipe _deploy/voyage/uploads/           (visitor photos live on the server)
#   - ship deployment/setup.php              (one-time installer, deleted post-setup)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PUBLIC="_deploy/voyage"
PRIVATE="_deploy/voyage-private"

echo "▶ building frontend…"
npm --prefix frontend run build

echo "▶ assembling $PUBLIC…"
mkdir -p "$PUBLIC/api" "$PUBLIC/uploads"
# --delete clears stale hashed assets from previous builds; the excludes are the
# files that belong to the server, not to the build.
rsync -a --delete \
  --exclude '/api' --exclude '/uploads' --exclude '/.htaccess' --exclude '/.ovhconfig' \
  frontend/dist/ "$PUBLIC/"
cp deployment/.htaccess    "$PUBLIC/.htaccess"
cp deployment/.ovhconfig   "$PUBLIC/.ovhconfig"
cp deployment/api-index.php "$PUBLIC/api/index.php"

echo "▶ assembling $PRIVATE…"
mkdir -p "$PRIVATE"
rsync -a --delete backend/src/ "$PRIVATE/src/"
rsync -a --delete backend/migrations/ "$PRIVATE/migrations/"
rsync -a --delete backend/public/ "$PRIVATE/public/"
rsync -a --delete backend/config/ "$PRIVATE/config/"
for file in bootstrap.php composer.json console.php migrate.php .env.example; do
  cp "backend/$file" "$PRIVATE/$file"
done

find _deploy -name '.DS_Store' -delete

# Guard rather than trust: a missing .env means the site 500s on every request.
[ -s "$PRIVATE/.env" ] || { echo "✗ $PRIVATE/.env is missing or empty — do not upload."; exit 1; }
[ -e "$PUBLIC/setup.php" ] && { echo "✗ setup.php ended up in the bundle — remove it."; exit 1; }

cat <<SUMMARY

✓ bundle ready
    $PUBLIC        $(du -sh "$PUBLIC"  | cut -f1)   → upload to server  voyage/
    $PRIVATE  $(du -sh "$PRIVATE" | cut -f1)   → upload to server  voyage-private/

  Upload the CONTENTS of each folder. Do not delete voyage/uploads/ on the server.
  New migrations are not applied by uploading — run their SQL in phpMyAdmin.
SUMMARY
