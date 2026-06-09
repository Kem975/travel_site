# Plan Review — Interactive Travel Journal ("Our Journey")

This is the improvement layer on top of your project plan. The original plan is solid;
the items below are the places where it has a **real bug, an internal contradiction, or a
risky assumption about the OVH shared-hosting environment**. Items are ordered by priority,
and cross-reference your section numbers.

---

## A. Critical fixes (correctness / security)

### A1. The `.htaccess` example will 404 every API route 🔴
Your §22 rewrite rules pass `^api/` straight to the filesystem:
```apache
RewriteRule ^api/ - [L]
```
But `/api/trips/south-america-2026` is **not a real file**, so Apache returns 404 before
PHP ever runs. You need a front controller and an internal route to it:
```apache
RewriteEngine On

# Route everything under /api to the PHP front controller (which parses the sub-path)
RewriteRule ^api/(.*)$ api/index.php [L,QSA]

# Serve real files/dirs (assets, uploaded images) as-is
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# SPA fallback: unknown routes -> index.html
RewriteRule ^ index.html [L]
```
`api/index.php` then reads `$_SERVER['REQUEST_URI']` (or `PATH_INFO`) to dispatch.
Also add: `Options -Indexes`, and `<FilesMatch>` / `RewriteRule` blocks denying
`.env`, `*.sql`, `*.log`, `/config`, `/migrations`, `/src` (PHP source must live **outside**
`www/` or be hard-denied — see A2).

### A2. The whole site is private — so the API gate must cover *every* read endpoint 🔴
Your §14 only marks `/admin/*` as protected. But §15 says the site is password-gated for
visitors too. As written, `GET /api/trips`, `GET /api/destinations/:slug`,
`GET /api/destinations/:id/comments`, and `POST .../comments` are **wide open** — anyone
who knows the URL bypasses your "private" requirement entirely.

**Fix:** two middleware tiers, applied to *all* content routes:
- `requireVisitorSession` → every non-admin GET/POST (trips, destinations, articles, photos, comments).
- `requireAdminSession` → everything under `/admin/*`.

This also **collapses your spam problem** (see B3): bots can't reach the comment form without
the shared password first.

### A3. Stored XSS via article blocks 🔴
You plan TipTap (§11.1) for rich editing and store block content as JSON (§13.5). TipTap
emits HTML. If a paragraph/quote block stores HTML and you render it with `dangerouslySetInnerHTML`,
a compromised or careless editor account becomes stored XSS on a family site.

**Fix:**
- Sanitize on the **server** before storing (PHP `HTML Purifier` with a tight allowlist:
  `b, i, em, strong, a[href], br, p`). Client-side Zod is not a security boundary.
- Validate `content_json` **per `block_type`** server-side (you have `backend/src/Validation/` — use it).
  Don't trust the shape of the JSON just because the client sent it.

### A4. 30-day "remember me" on PHP file sessions is fragile 🟠
§4.2/§13.8: native PHP sessions on shared hosting are files in a shared temp dir, garbage-collected
by `session.gc_maxlifetime` (often 1440s = 24 min on OVH mutualized). A 30-day login built on
that will randomly log people out.

**Fix:** use the DB-backed token you already sketched in §13.8 as the *primary* mechanism for
visitor persistence: a random 256-bit token, stored hashed, in an `HttpOnly; Secure; SameSite=Lax`
cookie with a 30-day `Max-Age`, validated against `sessions` on each request. Keep native PHP
sessions only for the short-lived admin area if you like, or use the same token approach for both.

### A5. Same-origin deployment — make it explicit (it simplifies everything) 🟢
Your §22 puts the SPA and `/api` on the **same domain**. Good — that means **no CORS**, and
`SameSite=Lax` cookies work cleanly. Write this down as an architectural invariant, because it
has consequences:
- `SameSite=Lax` already blocks cross-site POST-with-cookies, so CSRF tokens (§15.4) become
  defense-in-depth, not load-bearing. Keep them, but you're not one misconfig away from disaster.
- If you ever split the front end onto a different domain, you'd need `SameSite=None; Secure`
  **and** CORS-with-credentials. Don't, unless forced.

---

## B. Contradictions inside the plan to resolve

### B1. "Avoid recurring third-party costs" (Obj. 8) vs. MapLibre needing map tiles 🟠
A MapLibre globe needs vector/raster **tiles**. The usual sources (MapTiler, Mapbox) are
metered third-party services → recurring cost, contradicting Objective 8.

**Fix — self-host tiles with Protomaps PMTiles:** a single static `.pmtiles` file (the whole
world basemap, a few GB, or a clipped extract that's far smaller) sits in your OVH `www/`
and is served by range requests — **no tile server, no Node, no recurring fee.** This is the
cleanest fit for "everything runs on OVH, no third-party costs." Decide tile strategy *before*
the globe phase, not during it.

### B2. "Current location" pulse (§4.3/§16.1) vs. "don't expose real-time location" (§18) 🟠
A live "you are here" pulse on the globe directly contradicts the §18 privacy stance.

**Fix:** define **`current` = your most recently *published* destination**, which by §18's own
24–72h rule is a place you've already left. The pulse then says "where the story is right now,"
not "where our bodies are right now." One definition, both sections satisfied.

### B3. The privacy delay needs scheduled publishing — which you excluded from MVP 🟠
§18 wants "publish 24–72h after departure," but §19 excludes *scheduled publishing* from MVP.

**Fix:** for v1 the delay is achieved by **publishing manually after you've moved on** — no
scheduler needed. You're already at the next town; you hit Publish. The automated scheduler
stays a post-launch nicety, and §18 and §19 stop contradicting each other.

### B4. Heavy anti-spam stack is overkill once A2 is in place 🟢
§9.4 lists rate limiting + honeypot + min-fill-time + IP throttling + Cloudflare Turnstile +
moderation. But Turnstile is a third-party dependency (Obj. 8 again), and once comments live
behind the shared-password gate (A2), drive-by bots can't reach the form at all.

**Fix for MVP:** keep **honeypot + simple rate-limit + moderation**. Drop Turnstile and the
elaborate throttling to "later." Less to build, nothing lost on a gated site.

---

## C. Database schema corrections (§13)

- **C1. Photo `category` is missing.** §8.5 defines categories (landscapes, food, wildlife…)
  and §6.5 filters the gallery by them, but the `photos` table has no such column. Add
  `category VARCHAR` (or a small `photo_categories` lookup if you want them editable).
- **C2. Galleries have no home.** §7 has a `gallery` block and §6.5 a global gallery, but
  there's no `galleries` table and `photos` has no `gallery_id`. **Recommended:** don't add a
  table — a gallery block stores an **ordered array of photo IDs in its `content_json`**, and
  the global `/gallery` page is just a filtered query over `photos`. Consistent with the block model.
- **C3. Image variants aren't represented.** You generate 480/960/1600/2400 (§8.2) but store one
  `storage_path`. **Don't add columns** — derive variants **by filename convention**
  (`abc123-960.webp`) and reconstruct `srcset` in code. Store only the base name + the set of
  sizes that succeeded.
- **C4. Loose photos.** `photos.destination_id` should be **nullable** so you can bulk-upload
  before assigning. Add an optional `trip_id` (or always derive trip via the destination join)
  so trip stats and trip-level filtering work for unassigned shots.
- **C5. Drop `aspect_ratio`** (§8.4) — it's `width/height`, store those and compute. One less
  field to keep consistent.
- **C6. Article ↔ destination cardinality.** `GET /api/destinations/:slug/article` (singular)
  implies **1:1**. State it. (If truly 1:1 you *could* fold article fields into `destinations`,
  but keeping `articles` separate is fine for the draft/publish workflow — just make the
  one-to-one explicit with a unique constraint on `articles.destination_id`.)
- **C7. PII / GDPR (you're on OVH/France).** You already hash IPs (`ip_hash`) — good. Also:
  never return `author_email` in any public API response, and add a line to §6.6 (About →
  privacy) covering comment data. Low effort, correct for EU hosting.

---

## D. OVH shared-hosting reality checks (verify on YOUR account before relying on them)

These are environment assumptions that have historically bitten people on OVH mutualized/Web Cloud.
None are blockers, but each needs a 5-minute check in your OVH panel / a `phpinfo()` probe.

- **D1. PHP 8.5 availability.** 8.5 is recent; OVH mutualized often lags the newest minor by months.
  Confirm the selectable version. Write the code to target **8.3+** so 8.3/8.4/8.5 all work, rather
  than depending on a single 8.5-only feature.
- **D2. Imagick + AVIF.** AVIF encoding needs `libheif`, frequently **absent** on shared Imagick
  builds, and AVIF encode is CPU-heavy against `max_execution_time`/`memory_limit`.
  **Recommendation:** **WebP-only for MVP** (§8.3), AVIF as a post-launch enhancement *if* the
  extension is present. Verify which of GD/Imagick exists and whether each does WebP.
- **D3. Synchronous variant generation may time out.** Four resizes per image inside one PHP
  request can blow `max_execution_time` on a large batch. You already do client-side downscale
  (§8.1) — lean on it hard (resize to ≤2400px in the browser before upload), process **one image
  per request**, and return progress. Avoid "upload 40 photos → one giant request."
- **D4. Upload limits.** `upload_max_filesize` / `post_max_size` / `max_input_time` are low by
  default. Client-side resize keeps you under them; set `.user.ini`/`.htaccess` overrides where allowed.
- **D5. SSH / cron for deploy & backups.** OVH Web Cloud usually has SSH + cron, cheaper plans may
  not. Your deploy (rsync) and backups (mysqldump cron) both assume SSH. Confirm; if SSH is absent,
  fall back to SFTP deploy + a token-protected `/admin/run-migrations` endpoint.

---

## E. Practical gaps for an 8-month trip

### E1. The **author** experience on mobile + flaky networks is a first-class requirement 🟠
The plan optimizes the **visitor** for mobile (§17.6) but you'll be *publishing* from hostel
Wi-Fi and Andean 3G, possibly from a phone, not a laptop. That's the harder problem.

Add to MVP requirements:
- Admin UI usable on a **phone** (you may not always have the laptop out).
- **Resilient uploads:** per-image requests, automatic **retry**, a visible **queue** that
  survives a dropped connection, and **aggressive client-side compression** before upload.
- **Draft offline / save often:** never lose a half-written article to a tab reload on bad Wi-Fi.

### E2. Backups: be concrete, and protect the right thing 🟠
Your photo **originals already live in Google Photos/OneDrive** (§8.1, §23) — so losing
`/uploads` is annoying but recoverable by re-upload. The **truly irreplaceable asset is the
MySQL database** (your written stories, structure, comments). Prioritize it:
- Nightly `mysqldump` via cron → gzip.
- **Push at least one copy off OVH automatically.** Concrete options that work on shared hosting:
  email the gzipped dump to yourself, `curl` it to Backblaze B2 (S3 API, ~free at this size), or
  pull it nightly to a home machine via cron + scp. "At least one backup outside OVH" (§23) only
  counts if it's automated — a manual habit will lapse on month 3 of travel.
- Document + **test the restore** once before departure. A backup you've never restored is a guess.

### E3. A deploy script, defined (§12 has `deployment/scripts/` but it's empty) 🟢
Make the loop one command: `build → upload → migrate`.
```
1. cd frontend && npm run build          # hashed assets into dist/
2. rsync dist/ -> OVH www/ (or SFTP)     # SPA shell + assets
3. run DB migrations (CLI over SSH, or the protected endpoint from D5)
```
Plus a **migration runner** in `backend/migrations/` (you have the folder). Even a tiny
"apply *.sql in order, track applied versions in a `migrations` table" script beats hand-running SQL.

### E4. A thin test layer for the security-critical paths 🟢
§9 ("Polish") mentions a security review but no automated tests. You don't need full coverage,
but write a few PHP tests for the parts where a bug is expensive and silent: **auth/session,
upload validation (real MIME + decode), comment moderation state machine, and that PDO is always
parameterized.** These are exactly the spots manual QA misses.

---

## F. Product decisions worth making before building (not bugs — forks)

- **F1. UI language.** You and your family are French-speaking (OVH, your phrasing). The plan is
  in English and defers *multilingual* — but that's about **article content**; the **interface**
  language is a separate choice. Recommendation: **French UI**, single-language articles for v1,
  with strings centralized so a second language is possible later. (Captured as an open decision.)
- **F2. Globe technology.** MapLibre v5 *can* render a globe, but its strength is **interactive
  geographic maps** (perfect for your §6.4 destination mini-maps). The **hero "rotating marble"**
  (atmosphere, cinematic auto-rotate, zoom-to-destination) is lighter and more art-directable with
  a three.js globe (`globe.gl`/`react-globe.gl`) or the tiny `cobe`. Recommendation: **hybrid —
  lightweight WebGL globe for the homepage, MapLibre only for the contextual mini-maps** — but a
  single MapLibre-for-everything choice is defensible if you'd rather learn one library. (Open decision.)
- **F3. Tighten the launch cut.** Your MVP (§19) is large: globe + articles + photos + comments +
  journal + gallery + full admin, all before an 8-month trip. The thing you need on **day 1 of
  travel is the ability to publish a destination and have family read it**. Recommendation: split:
  - **v1 (ship before departure):** auth gate · trip/destination/article admin · photo upload+variants ·
    **journal list** · destination article page · mobile · backups. *(Your §21 order already points here.)*
  - **v1.1 (build from the road):** interactive globe · comments · global gallery with filters ·
    AVIF · scheduler.
  This lets you leave with a working site and add the showpiece globe while you travel, instead of
  risking departure with a beautiful globe and no way to publish. (Open decision.)

---

## What I did *not* change (it's good as-is)
Block-based article model (§7) · status workflows for articles/destinations (§7.2–7.3) ·
the journal as an accessible, non-globe path to all content (§6.2, §16.5) · build-globe-last
ordering (§21) · `password_hash`/`password_verify` + PDO prepared statements (§15) · the
photography-first article layout and column widths (§6.4) · the overall stack shape
(Vite/React/TS + PHP/MySQL on OVH, no Node in prod).

---

## Open decisions (need your call before the relevant phase)
1. **UI language** — French (recommended) / English / bilingual-later.
2. **Globe tech** — hybrid lightweight-globe + MapLibre mini-maps (recommended) / MapLibre everywhere.
3. **Launch cut** — defer globe + comments + global gallery to v1.1 (recommended) / keep full MVP.
4. **(Your action)** OVH probes from §D: PHP version, Imagick/GD + WebP/AVIF, SSH+cron. A one-file
   `phpinfo()` upload answers most of D1–D4.
