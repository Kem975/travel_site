#!/usr/bin/env bash
#
# Print the SQL to paste into phpMyAdmin for migrations production hasn't run yet.
#
# There is no SSH on the host, so migrate.php can never run there: new migrations
# are applied by hand. This exists so that "by hand" means one paste in the right
# order, rather than opening several files and hoping — a half-applied migration
# is how the site went down on 1 Sept.
#
#   ./deployment/scripts/pending-sql.sh 007_article_lang.sql 008_recipes.sql
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

[ $# -gt 0 ] || { echo "usage: $(basename "$0") <migration.sql>..." >&2; exit 1; }

for version in "$@"; do
  [ -f "backend/migrations/$version" ] || { echo "no such migration: $version" >&2; exit 1; }
done

for version in "$@"; do
  printf -- '-- ═══ %s ═══\n' "$version"
  cat "backend/migrations/$version"
  printf '\n'
done

cat <<'SQL'
-- ═══ bookkeeping ═══
-- Marks the above as applied, so a future migrate.php run never replays them.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(255) NOT NULL PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL

printf 'INSERT IGNORE INTO schema_migrations (version) VALUES\n'
last=$#
i=0
for version in "$@"; do
  i=$((i + 1))
  printf "  ('%s')%s\n" "$version" "$([ "$i" -eq "$last" ] && echo ';' || echo ',')"
done
