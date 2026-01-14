# Hosted Storage Plan (Same-Origin Server)

## Purpose
You asked for persistence "where the app is hosted" (server-side), not device or cloud, and to review every code area that would change or be affected. This document:
- Maps the current storage flows (functions + files).
- Lists all impacted modules and tests.
- Analyzes feasibility and tradeoffs.
- Proposes implementation options and a recommended path.

## Important constraint conflict (must be resolved)
Current project invariants and the v4 spec state:
- **Local-first, no backend** (AGENTS.md + spec).
- **IndexedDB-first** persistence.

A hosted server store is **a backend** and violates those invariants unless the spec/AGENTS are updated. If you want hosted persistence, the spec and invariants must be explicitly changed. I can draft the spec updates once you confirm.

## Current storage architecture (execution flow + functions)

### Boot sequence and state hydration
- `app.js`
  - `loadState()` (line ~259): loads state from `storageAdapter.loadState()` and merges legacy v3/v1 localStorage if needed.
  - `hydrateState(obj)` (line ~333): normalizes loaded state, merges default settings, insights, rosters, logs.
  - `initializeState()` and boot: `storageAdapter.loadState()` -> `hydrateState()` -> UI init.

### Storage adapter selection
- `storage/adapter.js`
  - `resolveAdapter()` chooses IndexedDB (`idbAdapter`) if available; falls back to `localAdapter`.
  - `storageAdapter.loadState()` enriches meta via `buildMeta`, ensures `insights` exists, updates `persistStatus`.

### Persistence writes
- `app.js`
  - `persistDay(dateKey, dayLog)` -> `storageAdapter.saveDay`
  - `persistSettings()` -> `storageAdapter.saveSettings`
  - `persistRosters()` -> `storageAdapter.saveRosters`
  - `persistInsights()` -> `storageAdapter.saveInsights`
  - `persistAll()` -> saves meta/settings/insights/rosters + every day log

### Snapshots and diagnostics
- `storage/snapshots.js`
  - `savePreImportSnapshot`, `savePreMigrationSnapshot`, `saveSnapshotWithRetention`
- `storage/adapter.js` exposes `listSnapshots`, `saveSnapshot`, `restoreSnapshot`, `deleteSnapshot`
- `ui/legacy.js`
  - `renderDiagnostics()` lists snapshots and shows storage mode + persist status.

### Import/export
- `app.js`: `applyImportPayload()` uses `mergeRosters`, `mergeLogs`, `savePreImportSnapshot`.
- `storage/import_flow.js`: pure functions for merge/validation.
- `storage/export.js`: export payload formatting.
- `storage/encrypted_export.js`: AES-GCM export/import.

### Storage backends
- `storage/idb.js`: IndexedDB stores (meta/settings/rosters/insights/logs/snapshots).
- `storage/local.js`: localStorage fallback keys.
- `storage/persist.js`: `navigator.storage.persist()` checks.

### Service worker
- `sw.js`: app-shell precache, runtime cache for images.
  - It does **not** currently intercept API routes (good), but any future API endpoints must be kept out of `ASSET_SET` to avoid caching issues.

### Tests that touch storage
- `storage/*.test.mjs` (adapter, meta, merge, import_flow, snapshots, etc.).
- `tests/browser/*.test.mjs` (IDB + WebCrypto).
- `tests/e2e/*.e2e.mjs` (diagnostics, import/export, time model, etc.).

## Code areas impacted by hosted storage

### 1) Storage adapter layer
- `storage/adapter.js`
  - Must add a **new adapter** for hosted persistence (e.g., `remoteAdapter`).
  - Must adjust `resolveAdapter()` to choose remote when configured.
  - `getStorageMode()` should include a new mode, e.g., `"hosted"`.

### 2) Meta and diagnostics
- `storage/meta.js`
  - `storageMode` enum must include hosted.
  - `persistStatus` is meaningless for hosted; add a new field like `syncStatus` or `remoteStatus`.
- `ui/legacy.js` and `ui/elements.js`
  - Diagnostics UI must display remote status and last sync timestamp.

### 3) Persistence flows in app.js
- All persistence calls (`persistDay`, `persistSettings`, `persistRosters`, `persistInsights`, `persistAll`) assume device storage.
- With hosted storage, these calls must either:
  - write through to server (synchronous remote), or
  - queue and sync in the background.

### 4) Import/export + snapshots
- Snapshots are currently stored via adapter (local IDB/localStorage).
- With hosted storage, snapshots can live on server **or** remain local backups.
- Import flow should continue to create pre-import snapshots, but the storage location must be explicit.

### 5) Tests and tooling
- `storage/adapter.test.mjs` must include hosted mode coverage.
- Browser tests may need to skip hosted mode unless a test server is running.
- E2E should validate hosted sync flows if enabled.

### 6) Spec and invariants
- v4 spec explicitly requires local-first and IndexedDB-first. Must be updated.
- README and QA docs would need updates to reflect hosted storage.

## Clarifying the requirement (hosted vs cloud)
"Store data where the app is hosted" implies a server that can **write** data. Static hosts (GitHub Pages) cannot do this.
So this is effectively a backend, even if it is the same origin.

**If you want cross-device sync, you need all three:**
1) A write-capable server.
2) A user identity or shared secret for access control.
3) A conflict resolution strategy.

## Design options (with tradeoffs)

### Option A: Server-authoritative storage (no local persistence)
**What it is:** the app reads/writes directly to the server; no IDB/localStorage retention.

**Pros**
- Simple mental model: one canonical source.
- Easy cross-device consistency.

**Cons**
- Breaks local-first + offline.
- Latency impacts the 10-second speed rule.
- Any network issue blocks logging.
- Larger engineering to make UI tolerant of partial saves.

**Verdict:** Not recommended unless offline is explicitly dropped.

### Option B (recommended): Hosted sync + local cache
**What it is:** keep local IDB as a cache, and sync to hosted storage in the background.
- Local writes stay instant.
- Sync pushes/pulls in background.
- Server becomes shared source for multi-device.

**Pros**
- Preserves speed and offline capability.
- Low UX friction.
- Works even if server is temporarily down.

**Cons**
- Still "stores on device" (as a cache). If that is unacceptable, this option may be rejected.

**Verdict:** Best UX and safest migration path.

### Option C: Hosted encrypted blob (manual push/pull)
**What it is:** re-use export/import, but store the exported (encrypted) blob on the server. Users manually sync.

**Pros**
- Minimal backend complexity.
- Strong privacy if E2EE is enforced.

**Cons**
- Not automatic; user must manage sync.
- Still not real-time across devices.

**Verdict:** Good if minimal server complexity is desired.

## Recommended approach
Given the goals (multi-device persistence with minimal friction), **Option B** is the most practical. It is also easiest to build incrementally:
1) Add hosted adapter as a **sync target**, not as a replacement.
2) Keep IDB as the local cache; sync in the background.
3) Make remote storage explicit and opt-in (since this breaks the current invariants).

If you *truly* want zero local persistence, then Option A is feasible but will degrade speed and offline reliability.

## Proposed hosted storage design (Option B)

### 1) Data model on server
Two viable shapes:

**a) Full state blob (simplest)**
- Server stores a single JSON blob per user: `{ meta, settings, rosters, insights, logs }`.
- Client PUTs entire state on each change (or at intervals).

**b) Incremental stores (recommended)**
- Server stores the same logical partitions as IDB:
  - `meta`, `settings`, `rosters`, `insights`, `logs`, `snapshots`.
- Client uses per-entity endpoints, mirroring `saveDay`, `saveSettings`, etc.

**Recommendation:** Start with **full-state blob** for MVP, then upgrade to incremental once stable.

### 2) API endpoints (example, same-origin)
**Blob-based MVP**
- `GET /api/state` -> returns the full state + etag/version.
- `PUT /api/state` -> replaces state if `If-Match` or `version` is current.

**Incremental**
- `GET /api/meta`
- `PUT /api/meta`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/rosters`
- `PUT /api/rosters`
- `GET /api/insights`
- `PUT /api/insights`
- `GET /api/logs?since=` (delta)
- `PUT /api/logs/:dateKey`
- `GET /api/snapshots`
- `POST /api/snapshots`
- `DELETE /api/snapshots/:id`
- `POST /api/restore/:snapshotId`

### 3) Identity / auth
You need a way to scope data per user.
Options:
- **Email/password** (traditional account system).
- **Passphrase-only**: derive a user ID from a hashed passphrase. Server stores encrypted data keyed by this hash.
- **Invite token**: a one-time token tied to a shared storage space.

**Recommendation:** passphrase-only + E2EE for minimal overhead, unless you want account recovery.

### 4) Encryption (strongly recommended)
If data lives on a server, encrypt before uploading:
- Use AES-GCM with PBKDF2 (already in `storage/encrypted_export.js`).
- Store only ciphertext + params on server.
- The server never sees plaintext.
- This keeps the "local-first privacy posture" even with a backend.

### 5) Sync / merge strategy
Leverage existing merge logic:
- Per-day merge uses `mergeDay` with `(rev, tsLast)`.
- Roster merge uses IDs, with optional dedupe by label.
- Insights merge is already implemented (`mergeInsightsState`).

**Sync algorithm (hybrid):**
1) On boot: load local state, then fetch remote.
2) Merge remote into local using existing merge functions.
3) Persist merged state locally.
4) Push merged state back to server.

**Conflict resolution:**
- Treat remote and local as peers; merge both using v4 merge rules.
- Keep `rev` and `tsLast` monotonic on updates.

### 6) Changes to storage adapter
Introduce `remoteAdapter` with the same interface:
- `loadState`, `saveDay`, `saveSettings`, `saveRosters`, `saveInsights`, `saveMeta`, `listSnapshots`, `saveSnapshot`, `deleteSnapshot`, `restoreSnapshot`.

Then add a new **SyncAdapter** that wraps local + remote:
- Local writes remain immediate.
- Remote writes are queued and retried.
- On startup, do a pull/merge/push.

### 7) UI changes
- Settings: add a "Hosted Sync" section with status, last sync, errors.
- Diagnostics: add `remoteStatus`, last sync timestamp, and conflict count.

### 8) Service worker considerations
- Ensure `/api/*` is never cached by the app-shell cache.
- Fetch to API should be network-only to avoid stale state.

### 9) Test strategy
- Unit tests for merge + adapter behavior with a mock server or test HTTP server.
- Browser tests should keep using real IDB, but may skip hosted unless a server is running.
- E2E test scenario: "device A logs, sync, device B sees log".

## Alternative if "no device persistence" is mandatory
If you must avoid local persistence entirely:
- Replace `storageAdapter` with a remote-only adapter.
- `loadState()` must fetch from server every boot.
- Remove `requestPersist` checks and Diagnostics fields related to persistent storage.
- Expect a major UX regression (no offline, higher latency).

I do not recommend this unless you explicitly accept these tradeoffs.

## Recommended next steps
1) Confirm whether you are OK breaking "local-first" and adding a backend.
2) Decide between **Option B (hybrid)** or **Option A (remote-only)**.
3) If hybrid, choose:
   - Full-state blob API (fastest to implement).
   - Incremental per-entity API (cleaner long-term).
4) Decide auth model (passphrase-only vs accounts).
5) I can then draft a concrete implementation plan and code changes.

---

## Spec update draft (required to allow hosted storage)

Below are proposed edits to align the spec + invariants with hosted storage. These are **drafts** and should be approved before implementation.

### AGENTS.md invariants (replace or amend)
Current invariant: **Local-first, no backend.**

Proposed revision (pick one):

**Option B (recommended: hybrid local cache + hosted sync)**  
\"Local-first by default; optional hosted sync can be enabled by the user. When enabled, data is stored on the app host and encrypted client-side. Local storage remains a cache for offline use.\"

**Option A (remote-only)**  
\"Hosted storage only: data is stored on the app host and is not persisted locally except transient runtime state.\"

### Spec section updates (Solar Log v4 Implementation.md)
Suggested changes (high-level headings):
1) **1.4 Privacy posture**  
Add: \"Optional hosted sync (same-origin) with client-side encryption and explicit opt-in.\"
2) **4.1 Storage strategy**  
Replace: \"IndexedDB primary\" with \"IndexedDB primary (cache) + hosted sync target\" (Option B), or \"Hosted storage primary\" (Option A).
3) **5.1 Persistence adapter**  
Add a hosted adapter, sync flow, and remote status metadata.
4) **11.2 Service worker strategy**  
Add: \"Do not cache /api/*; network-only for state endpoints.\"
5) **12.2 Backlog**  
Add item: \"Hosted sync (same-origin)\" and remove \"Opt-in cloud sync\" or clarify distinction.

### README updates (once approved)
- Add a \"Hosted Sync\" section with:
  - explicit opt-in
  - encryption requirement
  - sync status location (Diagnostics/Settings)
  - how to self-host server

---

## Implementation task list (file-by-file plan)

This assumes **Option B (hybrid local cache + hosted sync)**. If Option A is chosen, this list is shorter but includes larger UX tradeoffs.

### 1) Storage adapters
- `storage/adapter.js`
  - Add `remoteAdapter` (new file) and `syncAdapter` (new file).
  - Extend `resolveAdapter()` to choose `syncAdapter` when hosted sync is enabled.
  - Add new storage mode: `\"hosted\"`.
  - Propagate remote status into meta (see below).

- `storage/remote.js` (new)
  - Implements the adapter interface over HTTP.
  - Supports `loadState`, `saveDay`, `saveSettings`, `saveRosters`, `saveInsights`, `saveMeta`, `listSnapshots`, `saveSnapshot`, `deleteSnapshot`, `restoreSnapshot`.
  - Uses `fetch` with same-origin `/api/*`.

- `storage/sync.js` (new)
  - Wraps `localAdapter`/`idbAdapter` + `remoteAdapter`.
  - Local writes are immediate; remote writes are queued and retried.
  - On boot: pull remote, merge, persist locally, push merged state.

### 2) Meta + diagnostics
- `storage/meta.js`
  - Extend `storageMode` enum to include `\"hosted\"`.
  - Add fields: `remoteStatus`, `remoteLastSyncTs`, `remoteLastError` (optional).

- `ui/elements.js` / `index.html` / `ui/legacy.js`
  - Add Diagnostics rows for hosted sync status + last sync time.
  - Surface errors non-intrusively (toast + diagnostics).

### 3) Settings / UX for hosted sync
- `ui/legacy.js` (Settings tab)
  - Add UI controls: \"Enable hosted sync\" toggle, passphrase prompt (if E2EE), sync status display, \"Sync now\" button.
  - Store config in settings (e.g., `settings.sync = { enabled, serverUrl?, mode, lastSyncTs }`).

- `app.js`
  - Ensure settings change triggers `storageAdapter` to re-resolve (or reload).
  - Provide actions for manual sync + status refresh.

### 4) Encryption (if enabled)
- Reuse `storage/encrypted_export.js` to encrypt payloads.
  - Store encrypted blobs on server.
  - Client decrypts on load.
  - Add `settings.sync.encryption = \"required\"` or similar.

### 5) Merge + conflict handling
- Use existing `mergeDay`, `mergeRosters`, `mergeInsightsState`.
- For initial merge: server data merged into local, then re-uploaded.
- Add conflict metadata in diagnostics (e.g., counts of merged days).

### 6) Service worker
- `sw.js`
  - Ensure `/api/*` is never cached.
  - Consider bypassing SW for API calls (network-only).

### 7) Tests
- `storage/adapter.test.mjs`
  - Add hosted mode mocks and sync path tests.
- New `storage/remote.test.mjs` and `storage/sync.test.mjs`.
- `tests/e2e/`:
  - Add cross-device sync test using two browser contexts.

### 8) Docs
- Update `Solar Log v4 Implementation.md` and `README.md` once invariants are approved.
- Add `docs/hosted-sync-setup.md` with deployment instructions.
