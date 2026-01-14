# Shredmaxx — Solar Log v4 (PWA)

Hosted‑sync‑first tracker for the Shredmaxxing protocol with a segmented day model (FTN → Lunch → Dinner → Late). v4 focuses on ultra‑fast logging, durable replication, and explainable insights — with an **offline‑first cache** and no front‑end build chain.

## Status
- **Spec**: `docs/spec_vNext.md` (source of truth).
- **Implementation**: the PWA (`index.html`, `app.js`, `style.css`) remains a **v3 UI baseline** with **v4 core logic** wired in (protocol day model, roster IDs/tags, merge+snapshots, review/insights, privacy features, and **hosted sync by default with an IndexedDB cache**).

## What v4 tracks (fast)
- **FTN mode**: strict / lite / off (FTN segment only)
- **Move pre‑lunch** and **Training** (daily toggles)
- **HFHC collision** (computed + override)
- **Seed oils / unknown oils** (manual + hints)
- Food diversity **presence** per segment:
  - **Proteins** / **Carbs** / **Fats** / **Accoutrements (μ)**
- **High‑fat meal** and **High‑fat day** (computed + override)
- **Supplements** (optional module)
- **Signals**: Energy / Mood / Cravings (1–5)
- Notes (daily + per segment)
- Speed helpers: pinned + recents, undo toast, repeat last segment, copy yesterday (segment/all)

## Time model (v4)
- Formal **protocol day** anchored to `dayStart` with wrap‑around support (`dayEnd <= dayStart`).
- **activeDay(now)** resolves after midnight to the prior DateKey.
- Segment boundaries are wall‑clock minutes with deterministic DST clamping.
- Solar arc clamps inside the protocol day for stable rendering.

## Data, privacy, and portability (v4)
- **Hosted sync (same-origin)** is the default durability layer (multi-device convergence).
- **IndexedDB** is still used as an **offline-first cache** (UI reads/writes it first); `localStorage` remains a legacy fallback.
- Attempts **persistent storage** when supported (see Diagnostics).
- **Outbox replication**: offline edits queue and sync when back online (never blocks logging).
- **Snapshots** before import/migration/sync-reset; restore from Diagnostics.
- **Merge‑safe import** (default) + **Replace** option.
- Exports: **JSON** (sanitized, no sync credentials), **encrypted JSON** (AES‑GCM via WebCrypto), and **CSV** (per‑day rows).
- Optional hardening: **app lock**, **privacy blur**, **home redaction**. Optional **E2EE** makes hosted sync ciphertext-only.

## Hosted Sync (default)
- When deployed with a write-capable same-origin server, the app syncs to `/api/sync/v1/*` in the background.
- The UI always renders from the local cache first, so logging is instant and works offline.
- If the sync API is unavailable (e.g., static hosting / `python -m http.server`), the app falls back to local-only mode and continues to work.

## Review (v4)
- Weekly Review 2.0: coverage matrix, rotation picks, and local‑only correlations.
- Explainable rules engine for protocol insights (on‑device).

## Project structure
```
./
  index.html
  style.css
  app.js                  # v3 UI glue + v4 actions
  app/                    # boot + store + reducer + shared helpers
  ui/                     # rendering + event bindings
  domain/                 # time model, heuristics, review, insights
  storage/                # IndexedDB adapter, migration, import/export, snapshots
  sw.js                   # app-shell cache + update flow
  manifest.webmanifest
  icons/
  assets/fonts/
  docs/spec_vNext.md      # canonical spec (vNext)
  tests/                  # browser + e2e tests
  scripts/                # test runners
```

## Run the app
### Option A: open directly
Open `index.html` in a browser. (Service worker caching is limited without HTTPS or a local server.)

### Option B: run a tiny local server (recommended)
```bash
python3 -m http.server 5173
```
Then open `http://localhost:5173/` and install as a PWA if your browser supports it.

## Testing
### Node tests (domain/storage/app/ui helpers)
```bash
node --test app/*.test.mjs ui/*.test.mjs domain/*.test.mjs storage/*.test.mjs
```

### Browser-only unit tests (IndexedDB/WebCrypto)
```bash
node scripts/run-browser-tests.mjs
```

### E2E (Playwright, optional dev-only)
```bash
node scripts/run-e2e.mjs
```
See `docs/testing-e2e-tooling.md` for setup and artifact locations.

## Manual QA checklist (v4)
- Storage: add a segment, reload, confirm data persists; verify Diagnostics shows storage mode + persist status + sync status.
- Snapshots: create a snapshot, restore it, then delete it; confirm Diagnostics updates snapshot count.
- Import/export: export JSON, import as merge, then import as replace; verify logs/rosters expected. Export encrypted, then import with passphrase.
- CSV export: export CSV and open in a spreadsheet; verify per‑day rows render.
- Copy yesterday: use “Copy yesterday” with a segment list and with “all”; verify overwrite confirm and undo.
- Review: ensure weekly summary, issue chips, correlations, matrix, and rotation picks render.
- Privacy: app lock works, blur on background works, home redaction hides labels.
- Hosted sync: make an offline edit, then go online; verify outbox drains and sync status returns to idle.
- Update flow: with service worker enabled, confirm update toast appears on new SW version.

## Files (current prototype)
- `index.html` UI shell
- `style.css` visual system
- `app.js` logic + storage (v4 adapter + v3 UI glue)
- `app/` tiny store + helpers + action logic
- `domain/` time model, heuristics, weekly review, roster logic, insights
- `storage/` IndexedDB adapter, migration, import/export, snapshots
- `ui/` rendering + event bindings (+ non‑DOM helpers)
- `sw.js` offline cache + update flow
- `manifest.webmanifest` PWA manifest
