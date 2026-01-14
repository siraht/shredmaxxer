# Testing Coverage Inventory (v4)

This document summarizes current automated test coverage and gaps. It is a snapshot to guide the testing beads under `shredmaxxer-73z`.

## How to run (node-only unit tests)
```bash
node scripts/run-node-tests.mjs
```
Notes:
- Defaults to scanning `domain/`, `storage/`, and `app/`.
- Optional filter: `--filter=weekly` to match file paths.
- Optional dirs: `--dirs=domain,storage` (comma-separated).

## How to run (browser unit tests)
```bash
node scripts/run-browser-tests.mjs
```
Notes:
- Uses Playwright (see `docs/testing-e2e-tooling.md`).
- Runs browser-only unit tests that require IndexedDB/WebCrypto.

## How to run (e2e)
```bash
node scripts/run-e2e.mjs
```
Notes:
- Uses Playwright (see `docs/testing-e2e-tooling.md`).
- Produces JSONL logs and artifacts under `artifacts/e2e`.

## Current test surface
- Node unit tests run via structured JSONL runner (`scripts/run-node-tests.mjs`).
- Browser unit tests run via Playwright runner (`scripts/run-browser-tests.mjs`) for IndexedDB/WebCrypto paths.
- E2E tests run via Playwright with JSONL logs + artifacts (`scripts/run-e2e.mjs`).
- Some tests require real WebCrypto/IndexedDB and may skip when unavailable.

## Coverage matrix (module -> tests -> notes)

### Domain
- `domain/time.js` -> `domain/time.test.mjs`
- `domain/weekly.js` -> `domain/weekly.test.mjs`
- `domain/coverage.js` -> `domain/coverage.test.mjs`
- `domain/correlations.js` -> `domain/correlations.test.mjs`
- `domain/flags.js` -> `domain/flags.test.mjs`
- `domain/heuristics.js` -> `domain/heuristics.test.mjs`
- `domain/recents.js` -> `domain/recents.test.mjs`
- `domain/revisions.js` -> `domain/revisions.test.mjs`
- `domain/roster.js` -> `domain/roster.test.mjs`
- `domain/roster_defaults.js` -> `domain/roster_defaults.test.mjs`
- `domain/rotation.js` -> `domain/rotation.test.mjs`
- `domain/roster_edit.js` -> `domain/roster_edit.test.mjs`
- `domain/insights.js` -> `domain/insights.test.mjs` (partial)
- `domain/search.js` -> `domain/search.test.mjs`

### Storage
- `storage/adapter.js` -> `tests/browser/adapter_idb.test.mjs` (browser-only smoke)
- `storage/export.js` -> `storage/export.test.mjs`
- `storage/idb.js` -> `tests/browser/idb_stores.test.mjs` (browser-only)
- `storage/import.js` -> `storage/import.test.mjs` (partial)
- `storage/import_flow.js` -> `storage/import_flow.test.mjs`
- `storage/meta.js` -> `storage/meta.test.mjs`
- `storage/merge.js` -> `storage/merge.test.mjs`
- `storage/migrate.js` -> `storage/migrate.test.mjs`
- `storage/migrate_v3.js` -> `storage/migrate_v3.test.mjs`
- `storage/validate.js` -> `storage/validate.test.mjs`
- `storage/snapshots.js` -> `storage/snapshots.test.mjs` (partial)
- `storage/csv.js` -> `storage/csv.test.mjs`
- `storage/csv_export.js` -> `storage/csv_export.test.mjs`
- `storage/encrypted_export.js` -> `storage/encrypted_export.test.mjs` (requires WebCrypto)

### App/UI/PWA
- `app.js` -> no automated tests
- `app/helpers.js` -> `app/helpers.test.mjs`
- `ui/legacy.js` -> no automated tests
- `ui/elements.js` -> no automated tests
- `app/store.js` -> `app/store.test.mjs`
- `app/reducer.js` -> `app/reducer.test.mjs`
- `sw.js` -> no automated tests

## Gaps (unit)
- Domain: existing tests are partial for insights (additional rule coverage may still be needed).
- Storage: `storage/adapter.js` and `storage/idb.js` have browser-only smoke tests; deeper edge coverage pending.
- App glue and UI logic are untested (app.js, ui/legacy.js).
- Service worker behavior is untested.

## Gaps (integration / e2e)
- PWA update flow relies on service worker registration behavior (ensure Playwright supports it).
- `docs/qa.md` still lists manual checks that can be added to e2e over time.

## Notes on real API requirements
- Encrypted export tests require WebCrypto and currently skip if unavailable.
- Storage adapter and IDB behavior require real IndexedDB (cannot be mocked per project constraints).

## Coverage expectations (no mocks)
- Every exported function has at least one deterministic test exercising core behavior.
- Edge cases/branches get explicit coverage (empty inputs, invalid inputs, boundary times).
- Time/DST/sun computations use invariant assertions (monotonicity, bounds, status flags) instead of timezone-specific exact values.
- App/UI tests should prefer pure helpers or real browser interactions (avoid DOM mocks).

## Time/sun test strategy (deterministic)
- `parseTimeToMinutes`, `minutesToTime`, `liftBoundary`, `computeProtocolBoundaries`: assert exact outputs.
- `clampLocalTime`: assert `clamped`/`reason` and that returned minutes are within [0, 1439].
- `activeDayKey`: assert correct DateKey switching across wrap-around boundaries.
- `computeSunTimes`: assert status + bounds, not exact times (timezone dependent).

## Next steps (linked beads)
- `shredmaxxer-73z.1`: Coverage audit + matrix.
- `shredmaxxer-73z.2` / `73z.3` / `73z.4`: Domain unit test expansion.
- `shredmaxxer-73z.5`: Storage adapter/IDB/meta/snapshots tests.
- `shredmaxxer-73z.6`: App/UI glue tests.
- `shredmaxxer-73z.7` → `73z.8`/`73z.9`/`73z.10`: E2E harness + scenario coverage.
