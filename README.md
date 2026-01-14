# Shredmaxx — Solar Log v4 (PWA)

Local-first tracker for the Shredmaxxing protocol with a segmented day model (FTN → Lunch → Dinner → Late). The v4 goal is ultra-fast logging, durable storage, and explainable insights — all without a backend or build chain.

## Status
- **Spec**: `Solar Log v4 Implementation.md` (source of truth for v4).
- **Prototype**: the current PWA (`index.html`, `app.js`, `style.css`) is a **v3 baseline** implementation and still uses **localStorage**. v4 work is staged via the directory scaffolding below.

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

## Time model (v4)
- Formal **protocol day** anchored to `dayStart` with wrap‑around support (`dayEnd <= dayStart`).
- **activeDay(now)** correctly resolves after midnight to the prior DateKey.
- Segment boundaries are wall‑clock minutes with deterministic DST clamping.

## Data, privacy, and portability (v4)
- **IndexedDB‑first** persistence with **localStorage** fallback.
- **Snapshots** before import/migration; restore from Diagnostics.
- **Merge‑safe import** and non‑destructive default behavior.
- Optional hardening: **app lock**, **privacy blur**, **encrypted export** (AES‑GCM via WebCrypto).

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

## Files (current prototype)
- `index.html` UI shell
- `style.css` visual system
- `app.js` logic + storage (v3 baseline)
- `sw.js` offline cache
- `manifest.webmanifest` PWA manifest
