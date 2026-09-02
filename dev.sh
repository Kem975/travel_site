#!/usr/bin/env bash
#
# Local dev launcher for Our Journey (macOS, and Linux/WSL).
# Starts: MySQL → PHP API (:8000) → Vite dev server (:5173).
# Ctrl+C stops PHP + Vite; MySQL is left running.
#
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# The isolated .devdb instance exists because this Mac's Homebrew MySQL 9.2 is
# broken. Everywhere else mysqld is on PATH and runs its own data dir, so prefer
# the Homebrew 8.0 binaries when they're actually there and fall back to PATH.
BREW_MYSQL="/opt/homebrew/opt/mysql@8.0/bin"
MYSQLD="${MYSQLD:-$([ -x "$BREW_MYSQL/mysqld" ] && printf %s "$BREW_MYSQL/mysqld" || command -v mysqld)}"
MYSQLADMIN="${MYSQLADMIN:-$([ -x "$BREW_MYSQL/mysqladmin" ] && printf %s "$BREW_MYSQL/mysqladmin" || command -v mysqladmin)}"
DEVDB="$ROOT/.devdb"

# Clear any leftovers from a previous run (MySQL is left alone).
pkill -f "php -S 127.0.0.1:8000" 2>/dev/null || true
pkill -f "[v]ite" 2>/dev/null || true
sleep 0.5

# 1) MySQL — only ever auto-started when the isolated .devdb instance is the one
# in play. On a machine with a normal MySQL, starting a second server on the same
# port would just fail confusingly, so say what to do instead.
mysql_up() { [ -n "$MYSQLADMIN" ] && "$MYSQLADMIN" --host=127.0.0.1 --port=3306 ping >/dev/null 2>&1; }

if ! mysql_up; then
  if [ -d "$DEVDB/data" ] && [ -n "$MYSQLD" ]; then
    echo "▶ starting MySQL (.devdb)…"
    nohup "$MYSQLD" --datadir="$DEVDB/data" --socket="$DEVDB/mysql.sock" --port=3306 \
      --bind-address=127.0.0.1 --pid-file="$DEVDB/mysqld.pid" --mysqlx=0 \
      --log-error="$DEVDB/mysqld.err" >/dev/null 2>&1 &
    disown || true
    for _ in $(seq 1 40); do mysql_up && break; sleep 0.5; done
  else
    echo "⚠ No MySQL answering on 127.0.0.1:3306, and no .devdb instance to start."
    echo "  Start your own server (Linux/WSL: sudo service mysql start), then re-run."
    echo "  Carrying on — the API will boot but every database call will fail."
  fi
fi
mysql_up && echo "✓ MySQL ready (127.0.0.1:3306)"

# 2) Frontend deps (first run only).
[ -d frontend/node_modules ] || { echo "▶ installing frontend deps…"; (cd frontend && npm install); }

# 3) PHP API (background).
php -S 127.0.0.1:8000 backend/public/index.php >/tmp/oj_php.log 2>&1 &
PHP_PID=$!
echo "✓ PHP API (http://localhost:8000)  log: /tmp/oj_php.log"

cleanup() {
  echo
  echo "▶ stopping PHP + Vite (MySQL stays up)…"
  kill "$PHP_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

cat <<EOF

────────────────────────────────────────────
  Our Journey — local dev
    App      → http://localhost:5173
    Admin    → http://localhost:5173/admin/login
    API test → http://localhost:8000/api/health

  Test credentials (dev DB):
    Trip password : trip-secret-123
    Admin login   : admin@example.com / admin-pass-456

  Press Ctrl+C to stop. (Run ./stop-dev.sh from another shell to stop too.)
────────────────────────────────────────────
EOF

# 4) Vite in the foreground so you see HMR logs; Ctrl+C here stops everything.
npm --prefix frontend run dev
