# E2E tooling decision (dev-only)

## Decision
Use **Playwright** as the headless browser tool for e2e and browser-only unit tests.

## Why Playwright
- Handles file downloads (export tests) reliably.
- Works well with service workers and offline testing.
- Can run headed for visibility-change tests (privacy blur) and headless for CI.
- Supports multiple browsers and real WebCrypto/IndexedDB.
- Good failure diagnostics (screenshots, video, traces).

## Constraints
- Dev-only tooling. No runtime build chain changes.
- No mocks/fakes for storage or crypto; use real browser APIs.

## Setup (proposed)
These steps are intended for local dev and CI only.

Option A (recommended once dev dependencies are added):
```bash
npm install -D playwright
npx playwright install --with-deps
```

Option B (ephemeral, no package.json changes):
```bash
npx playwright@latest install --with-deps
```

## Intended usage
- E2E harness uses Playwright via `node scripts/run-e2e.mjs`.
- Browser-only unit runner uses `node scripts/run-browser-tests.mjs` (Playwright).

## Commands
Install Playwright once (dev-only):
```bash
npm install -D playwright
npx playwright install --with-deps
```

Run e2e:
```bash
node scripts/run-e2e.mjs
```

Optional env vars:
- `E2E_PORT=5175` (default 5175)
- `HEADLESS=false` (run headed for visibility-change checks)
- `--filter=privacy` (run tests matching substring)

## Output paths
All artifacts are written under `artifacts/e2e/`:
- `logs/run-<timestamp>.jsonl` (JSONL event log)
- `screenshots/<test>-<timestamp>.png` (on failure)
- `traces/<test>-<timestamp>.zip` (on failure)
- `videos/<test>/` (per-test video directory)

## Notes
- If we adopt Playwright, update `AGENTS.md` Tooling Notes to mention npm is required for test tooling only.
