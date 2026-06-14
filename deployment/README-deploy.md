# Deploying Our Journey to OVH (FTP + phpMyAdmin, no SSH)

Target: **voyage.kemen.fr** as an OVH "Multisite" subdomain. The frontend has no
runtime deps and the PHP backend has no Composer deps, so deployment is: upload
files, point the subdomain at a folder, run a one-time setup page, delete it.

## Final layout on the server
```
(FTP home — contains www/)
├── www/             ← kemen.fr main site (untouched)
├── voyage/          ← subdomain document root (PUBLIC)
│   ├── index.html, assets/, fonts/
│   ├── api/index.php   ← thin shim → ../../voyage-private/public/index.php
│   ├── setup.php        ← one-time; DELETE after use
│   ├── uploads/         ← visitor photos (writable)
│   ├── .htaccess
│   └── .ovhconfig       ← PHP 8.3 + production
└── voyage-private/  ← backend, NOT web-accessible (sibling of www, outside any docroot)
    ├── bootstrap.php, .env (secrets), src/, migrations/, public/index.php
```

The local bundle in `_deploy/` mirrors this: upload `_deploy/voyage/` → `voyage/`,
and `_deploy/voyage-private/` → `voyage-private/`.

## A. OVH Control Panel (manager.ovh.com)
1. **Multisite**: Hosting → *Multisite* → *Add a domain or subdomain*.
   - Domain: `voyage.kemen.fr`  ·  Root folder: `voyage`
   - Tick **SSL** (free Let's Encrypt). Enable **Force HTTPS** if offered.
   - If `voyage.kemen.fr` doesn't resolve later, add a DNS record for the subdomain
     (Multisite usually creates it automatically for OVH-managed domains).
2. **PHP version**: the shipped `voyage/.ovhconfig` requests PHP 8.3 — no action
   needed, but you can confirm it in the manager.
3. **Database**: the MySQL database `kemenfpkemen` already exists. phpMyAdmin is
   reachable from the manager if you ever need it.

> ⏳ SSL can take a few minutes to a couple of hours to issue. Login needs HTTPS
> (cookies are `Secure`). Don't test login until `https://voyage.kemen.fr` is live.

## B. FTP upload (FileZilla / Cyberduck)
Connect with your OVH FTP user, then:
- Upload **contents of** `_deploy/voyage/`  →  server `voyage/`
- Upload **contents of** `_deploy/voyage-private/`  →  server `voyage-private/`
- Ensure `voyage/uploads/` exists and is writable (755/775).

## C. First-run setup (replaces the CLI, since there's no SSH)
1. **Smoke test**: open `https://voyage.kemen.fr/api/health`
   → expect `{"status":"ok","php_version":"8.3…","database":"up",…}`.
   `database:up` confirms the DB connection.
2. Open `https://voyage.kemen.fr/setup.php?token=YOUR_SETUP_TOKEN`
   (the token is `SETUP_TOKEN` in `voyage-private/.env`).
   Fill in: admin email, display name, admin password, and the visitor (trip)
   password. Submit — it runs the DB migrations and creates the accounts.
3. **Delete `voyage/setup.php`** from the server.

## D. Verify
- `https://voyage.kemen.fr` → globe behind the password gate.
- Enter the trip password → globe homepage works.
- `/admin/login` → log in → dashboard.
- Create a trip + destination, **upload a test photo** (this proves GD/WebP works
  and `uploads/` is writable), publish, and view the destination page.

## E. Harden / backups
- Confirm HTTPS + Force HTTPS.
- Back up: phpMyAdmin → *Export* the `kemenfpkemen` database; FTP-download
  `voyage/uploads/`. Schedule periodically.
- Optional follow-up: self-host the map label glyphs (today they come from a public
  font server) for full first-party loading.

## Troubleshooting
- **Login does nothing / not staying logged in** → SSL not active yet. Either wait
  for HTTPS, or temporarily set `COOKIE_SECURE=false` in `voyage-private/.env`, then
  switch back to `true` once HTTPS is live.
- **`api/health` shows `database:down`** → check `DB_*` in `voyage-private/.env`
  against the OVH database page.
- **Photo upload fails** → confirm GD+WebP in the manager's PHP info, and that
  `voyage/uploads/` is writable.
- **500 on any API call** → errors are logged, not shown. Check the hosting's PHP
  error log in the manager.

## Re-deploying later (after code changes)
Rebuild and re-sync: `cd frontend && npm run build`, then re-assemble `_deploy/` and
re-upload `voyage/` (keep `uploads/` and never re-upload `setup.php`). The backend in
`voyage-private/` only needs re-uploading when PHP code changes.
