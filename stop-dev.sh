#!/usr/bin/env bash
#
# Stop the local PHP API + Vite dev server. MySQL is left running.
#
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pkill -f "php -S 127.0.0.1:8000" 2>/dev/null && echo "✓ stopped PHP API" || echo "· PHP API was not running"
pkill -f "[v]ite" 2>/dev/null && echo "✓ stopped Vite" || echo "· Vite was not running"

echo
echo "MySQL (.devdb) is still running. To stop it too:"
echo "  /opt/homebrew/opt/mysql@8.0/bin/mysqladmin --socket=\"$ROOT/.devdb/mysql.sock\" -u root shutdown"
