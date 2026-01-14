# Shredmaxx — Solar Log v4 (PWA)

Local-first tracker for the Shredmaxxing protocol with a segmented day model (FTN → Lunch → Dinner → Late). The v4 goal is ultra-fast logging, durable storage, and explainable insights — all without a backend or build chain.

## Status
- **Spec**: `Solar Log v4 Implementation.md` (source of truth for v4).
- **Prototype**: the current PWA (`index.html`, `app.js`, `style.css`) is a **v3 UI baseline** with **v4 storage + roster migration** wired in. Persistence is **IndexedDB-first** with localStorage fallback.

## What v4 tracks (fast)
- **FTN mode**: strict / lite / off (FTN segment only)
- **Move pre‑lunch** and **Training** (daily toggles)
- **HFHC collision** (computed + override)
- **Seed oils / unknown oils** (manual)
- Food diversity **presence** per segment:
  - **Proteins** / **Carbs** / **Fats** / **Accoutrements (μ)**
- **High‑fat meal** and **High‑fat day** (computed + override)
- **Signals**: Energy / Mood / Cravings (1–5)
- Notes (daily + per segment)
- Speed helpers: pinned + recents, undo toast, repeat last segment, copy yesterday (segment/all)

## Time model (v4)
- Formal **protocol day** anchored to `dayStart` with wrap‑around support (`dayEnd <= dayStart`).
- **activeDay(now)** correctly resolves after midnight to the prior DateKey.
- Segment boundaries are wall‑clock minutes with deterministic DST clamping.

## Data, privacy, and portability (v4)
- **IndexedDB‑first** persistence with **localStorage** fallback.
- Attempts **persistent storage** when supported (see Diagnostics).
- **Snapshots** before import/migration; restore from Diagnostics.
- **Merge‑safe import** and non‑destructive default behavior.
- Exports: **JSON**, **encrypted JSON** (AES‑GCM via WebCrypto), and **CSV** (per‑day rows).
- Optional hardening: **app lock**, **privacy blur**. Encrypted exports can be imported with a passphrase.

## Review (v4)
- Weekly Review 2.0: coverage matrix, rotation picks, and simple local‑only correlations.
- Explainable rules engine for protocol insights (on‑device).

## Project structure
```
./
  app.js
  index.html
  style.css
  sw.js
  manifest.webmanifest
  icons/
  domain/           # time model, aggregators, heuristics, insights
  storage/          # IndexedDB adapter, migration, import/export
  ui/               # render + event bindings
  app/              # app boot, store, routing
  assets/fonts/     # bundled WOFF2 fonts (planned for v4)
```

## Run the prototype
### Option A: open directly
Open `index.html` in a browser. (Service worker caching is limited without https/local server.)

### Option B: run a tiny local server (recommended)
```bash
python3 -m http.server 5173
```
Then open `http://localhost:5173/` and install as a PWA if your browser supports it.

## Manual QA checklist (v4)
- Storage: add a segment, reload, confirm data persists; verify Diagnostics shows storage mode + persist status.
- Snapshots: create a snapshot, restore it, then delete it; confirm Diagnostics updates snapshot count.
- Import/export: export JSON, import as merge, then import as replace; verify logs/rosters expected. Export encrypted, then import with passphrase.
- CSV export: export CSV and open in a spreadsheet; verify per‑day rows render.
- Copy yesterday: use “Copy yesterday” with a segment list and with “all”; verify overwrite confirm and undo.
- Review: ensure weekly summary, issue chips, correlations, matrix, and rotation picks render.
- Update flow: with service worker enabled, confirm update toast appears on new SW version.

## Files (current prototype)
- `index.html` UI shell
- `style.css` visual system
- `app.js` logic + storage (v4 adapter + v3 UI glue)
- `domain/` time model, heuristics, weekly review, roster logic
- `storage/` IndexedDB adapter, migration, import/export, snapshots
- `sw.js` offline cache
- `manifest.webmanifest` PWA manifest
