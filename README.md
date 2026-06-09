# Our Journey

Private, password-protected travel journal — interactive globe, destination articles,
photo galleries, and family comments.

## Stack
- **Frontend:** Vite · React · TypeScript · Mantine · React Router · TanStack Query · react-i18next (FR/EN)
- **Backend:** PHP 8.3+ · PDO · MySQL (no framework — small router + PSR-4 autoload)
- **Hosting:** OVH Web Cloud (Apache), single origin (SPA + `/api` together, so no CORS)

## Docs
- [DECISIONS.md](DECISIONS.md) — locked technical choices
- [PLAN_REVIEW.md](PLAN_REVIEW.md) — critical fixes & rationale

## Local development

**Quick start (macOS):** `./dev.sh` starts MySQL + the PHP API + Vite together and prints the
URLs and test credentials. `./stop-dev.sh` (or Ctrl+C) stops PHP + Vite. The manual steps below
are the equivalent if you'd rather run each piece yourself.

### 1. Backend (PHP API) — port 8000
```bash
cp backend/.env.example backend/.env     # then edit DB_* credentials
php -S 127.0.0.1:8000 backend/public/index.php
```

### 2. Database + first-time auth setup
```bash
mysql -u root -e "CREATE DATABASE our_journey CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
# In backend/.env set DB_* and a unique APP_KEY:
#   php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
php backend/migrate.php

# Set the shared trip password and create the first admin (passwords never go in git):
php backend/console.php visitor:set-password "your-trip-password"
php backend/console.php admin:create you@example.com "Your Name" "your-admin-password"
```

> **On this Mac:** your Homebrew MySQL 9.2 is currently broken (missing `libabsl`
> dylib after an abseil upgrade) and mysql@8.0 can't open its 9.2 data dir. Dev uses an
> **isolated throwaway MySQL 8.0** in `.devdb/` (gitignored) instead — already seeded with
> trip password `trip-secret-123` and admin `admin@example.com` / `admin-pass-456`.
> Restart it after a reboot with:
> ```bash
> /opt/homebrew/opt/mysql@8.0/bin/mysqld --datadir="$PWD/.devdb/data" \
>   --socket="$PWD/.devdb/mysql.sock" --port=3306 --bind-address=127.0.0.1 \
>   --pid-file="$PWD/.devdb/mysqld.pid" --mysqlx=0 --log-error="$PWD/.devdb/mysqld.err" &
> ```
> To fix your main install instead: `brew reinstall mysql` (relinks against current abseil).

### 3. Frontend (Vite dev server) — port 5173, proxies `/api` → `:8000`
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the home page calls `/api/health` and shows API + database
status, the FR/EN toggle, and the light/dark switch (proving the Phase 1 foundation end to end).

## Production build
```bash
cd frontend && npm run build       # outputs frontend/dist/
```
Deploy `frontend/dist/` → OVH `www/`, backend front controller → `www/api/`, keep `backend/src`
**out of the web root**, and use [deployment/.htaccess](deployment/.htaccess).

## Status
- **Phase 1 — Foundation** ✓ React app ↔ PHP API ↔ MySQL.
- **Phase 2 — Authentication** ✓ Visitor password gate + admin login on DB-token sessions
  (HttpOnly/SameSite=Lax cookies), `requireVisitor`/`requireAdmin` middleware, CSRF on
  mutations, login rate limiting, and the React password gate + admin login/dashboard.

- **Phase 3 — Trips & destinations** ✓ Admin CRUD for trips and destinations (server-side
  validation, slug generation, route ordering, the five destination statuses, `published_at`
  stamping), public read endpoints with privacy filtering, dashboard stats, public trip list.
  Admin UI is lazy-loaded (§17.2). Coordinates are lat/lng inputs for now — the map picker
  comes with MapLibre in the globe phase.

Next (per §21 build order — content before the globe): **Articles** — the block-based editor
(`@mantine/tiptap`, with the server-side HTML sanitize from PLAN_REVIEW A3) and previous/next nav.
