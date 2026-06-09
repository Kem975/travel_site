# Locked Decisions — Our Journey

These are settled. See [PLAN_REVIEW.md](PLAN_REVIEW.md) for the reasoning and the critical
fixes that carry into the build regardless of these choices.

## D1 — UI language: **Bilingual FR + EN from v1**
- Interface (menus, buttons, admin) localized in **French and English**, with a header toggle,
  choice persisted to `localStorage`.
- Implemented with **react-i18next**; UI strings live in `frontend/src/locales/{fr,en}.json`.
- **Article content stays single-language per post** (you pick the language when writing).
  Per-article translation is explicitly out of scope.

## D2 — Globe: **MapLibre GL JS for everything**
- Homepage hero globe uses MapLibre **v5 globe projection**; destination mini-maps (§6.4) use
  the same library.
- **Tiles self-hosted via Protomaps PMTiles** — a single static `.pmtiles` basemap served from
  OVH `www/`, no tile server, no recurring third-party fee (resolves Obj. 8 vs. tiles).
- Globe is still built **last** (§21); this only fixes the tech + tile choice now.

## D3 — Scope: **Full MVP (§19) before departure**
- Globe, comments, and global gallery are all in v1 (no v1/v1.1 split).
- Trade-off accepted: larger pre-departure build. Build order still follows §21
  (content + admin first, globe last) so there's always a working publish path.

## D4 — Component library: **Mantine**
- Mantine provides UI, theming, and **dark/light** (`MantineProvider` + persisted color scheme).
- Mantine **subsumes** several separately-listed deps:
  - `@mantine/tiptap` → article rich-text editor (TipTap-based ⇒ **server-side HTML sanitize still required**, PLAN_REVIEW A3).
  - `@mantine/carousel` → galleries (Embla under the hood; **drop standalone Embla**).
  - `@mantine/form` → forms (**replaces React Hook Form**; Zod still used for shared schemas).
  - `@mantine/dropzone` → photo uploader (§10.5).
  - `@mantine/spotlight` → destination search (§8.1); `@mantine/notifications`, `@mantine/modals`.
- **Kept separate:** PhotoSwipe (true zoomable lightbox), optionally Framer Motion (globe→article transition).

## Carried-over critical fixes (apply during build — from PLAN_REVIEW.md)
- **A1** `.htaccess`: route `^api/(.*)$ → api/index.php` (the original example 404s all API routes).
- **A2** `requireVisitorSession` on **every** non-admin content/comment endpoint (site is private).
- **A3** Sanitize TipTap/Mantine editor HTML **server-side** (HTML Purifier) before storing.
- **A4** 30-day visitor persistence via **DB token cookie**, not PHP file-session GC.
- **B2** `current` destination = most recently **published** one (not live location).
- **C** Schema deltas: photo `category`; galleries = photo-ID arrays in block `content_json`;
  variants by filename convention; nullable `destination_id`; drop `aspect_ratio`.

## Open — your action before the photo/deploy phases (PLAN_REVIEW §D)
- OVH probes: PHP version (target 8.3+), Imagick/GD + WebP (AVIF optional), SSH + cron.
  A single `phpinfo()` upload answers most of these.

## D5 — Build order: media pipeline BEFORE the article editor (revised 2026-06-09)
Articles depend heavily on photographs, so the media system is defined first — building the
block editor against an unfinished image schema would force a redesign. Revised sequence:
1. ✓ **Foundation** (Phases 1–3): auth, trips, destinations — committed & tagged `v0.1.0`.
2. ✓ **Photo / media pipeline**: upload + WebP variants + media library + picker + cover selection + gc.
3. ✓ **Article editor + renderer** (block model: richText/image/gallery/quote/practicalInfo/divider;
   server-side HTML sanitize; public renderer + prev/next). `map` block deferred to the globe phase.
4. ✓ **Comments** (pending-by-default moderation, one reply level, honeypot + min-fill-time +
   keyed-IP rate limit, public thread, admin moderation queue).
5. ✓ **Journal / public reading experience** (journal, trip overview + stats, gallery + filters +
   lightbox, About, header nav).
6. **Interactive globe** ← current (MapLibre globe + self-hosted Protomaps PMTiles)
7. Polish & deploy
5. Journal / public reading experience
6. Globe (last, per §21)

The photo phase establishes: upload endpoint · real-MIME validation · generated filenames ·
browser-side compression · server-side WebP variants · image metadata · cover-photo selection ·
media-library picker · deletion rules · upload retry · orphan-file cleanup.

## D6 — Article = block model; TipTap edits ONE block type, not the whole article
`@mantine/tiptap` is a rich-text editor, **not** a block architecture. The article is a typed
list of blocks; TipTap only edits the `html` of a `richText` block:

    type ArticleBlock =
      | { type: 'richText';      html: string }
      | { type: 'image';         photoId: number; layout: 'normal' | 'wide' | 'fullBleed' }
      | { type: 'gallery';       photoIds: number[]; layout: 'grid' | 'masonry' | 'carousel' }
      | { type: 'map';           locations: LocationReference[] }
      | { type: 'quote';         text: string }
      | { type: 'practicalInfo'; items: PracticalItem[] }
      | { type: 'divider' }

Image/gallery blocks reference **stable photo IDs** from the media library — never embedded
URLs. `richText` HTML is sanitized server-side before storage (PLAN_REVIEW A3).
