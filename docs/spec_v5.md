## Solar Log v4 Implementation Plan Spec

**Project codename:** **Solar Log**
**Primary goal:** ultra-fast adherence + food-variety tracking for a segmented-day protocol (**FTN → Lunch → Dinner → Late**) with minimal friction, **hosted sync (same-origin)** durability, and an **offline-first local cache** so logging stays instant offline or online.

**v4 thesis:** keep the v3 feel, but harden the system with **robust time semantics**, **hosted sync (same-origin)** persistence, an **offline-first cache** for speed, **stable roster identity**, and **explainable insights**—still no build chain.

---

## 0) v4 delta overview

### v4 upgrades (high impact, low bloat)

* **Time model** becomes a formal **protocol day** anchored to `dayStart`, supporting wrap-around (`dayEnd <= dayStart`) with correct **active day** selection after midnight.
* Persistence becomes **hosted sync by default** (same-origin) with an **IndexedDB offline cache** + fallback, a persistent **outbox**, plus **pre-import/pre-migration snapshots** and **merge-safe import**.
* Multi-device durability: incremental **pull/merge/push** replication with **Hybrid Logical Clocks (HLC)**, **ETag/If-Match** optimistic concurrency, and batched uploads (never blocks logging).
* Rosters become **ID-based** with metadata: **stable IDs**, **tags**, **aliases**, **pinned**, **archived**.
* Meal-level “fuzzy” concepts become **computed + override**: **high-fat meal** and optional **collision auto-suggestion** (conservative).
* Weekly Review becomes a real behavior loop: **coverage matrix**, **rotation picks**, and simple local-only **correlations**.
* “Protocol insights” become a small on-device **rules engine** with reasons (no cloud, no AI dependency).
* UX speed features: **recents**, **repeat last**, **undo**, one-hand logging ergonomics.
* Optional privacy hardening: **app lock**, **privacy blur**, **encrypted export** via **WebCrypto AES-GCM**.
* PWA reliability: versioned **app-shell precache**, explicit update UX, and a **Diagnostics** panel.

---

## 1) Product intent and constraints

### 1.1 Purpose

Create a personal tool that makes it easy to execute the Shredmaxxing levers that matter most:

* **FTN (Fruit Till Noon)**
* **Move Before Lunch**
* Avoid **HFHC collisions** (high-fat + high-carb in same meal)
* Track **seed oil exposure**
* Implement fat strategy (**treat fat like a supplement**, plus **high-fat meal/day** and **high-fat day/week**)
* Keep **food diversity** high across **proteins / carbs / fats / accoutrements (μ)**

### 1.2 Non-goals

Intentionally excluded to avoid turning the app into a chore:

* **Calories/macros**
* **Weigh-ins/body measurements**
* **Full meal logging / ingredients**
* **Micronutrient quantities**
* **Perfect protocol correctness** (track levers + outcomes; user steers)

### 1.3 North Star UX rule

Every log action must be doable in **≤ 10 seconds**:

1. open app
2. tap the day segment
3. tap a few chips (P/C/F/μ + flags)
4. done

**Speed design principles**

* Optimize **scan time**: **Recents** and **Pinned** beat scrolling.
* Remove fear: **Undo** makes logging safe.
* Avoid modal complexity: keep flows tap-first, not form-first.

### 1.4 Privacy posture (hosted-by-default, optional hardening)

Default remains frictionless. The app uses **hosted sync (same-origin)** by default for durability, but always reads/writes the **local cache** first so it stays fast and fully functional offline.

Optional hardening (off-by-default):

* **App lock** (simple passcode)
* **Privacy blur** when backgrounded/task-switched
* **Encrypted export** using **WebCrypto AES-GCM**
* Optional sync privacy: enable **E2EE** so the server stores **ciphertext only** (client encrypts; server never sees plaintext)

---

## 2) Protocol-to-tracking mapping

### 2.1 Core levers to track

Highest adherence ROI:

1. **FTN mode** (Strict / Lite / Off)
2. **Move pre-lunch** (binary)
3. **Training** (binary)
4. **HFHC collision** (computed + override; meal-level)
5. **Seed oils / unknown oils** (manual; meal-level, with optional hints)
6. **Food diversity**: **Proteins / Carbs / Fats / Accoutrements (μ)** (presence-based)
7. **High-fat meal** (computed + override; meal-level)
8. **Signals**: **Energy / Mood / Cravings** (1–5 dots)
9. Notes (short) for exceptions, experiments, symptoms

### 2.2 Diversity model

Track *presence*, not amounts.

* **Proteins**: beef/bison/lamb/seafood/etc.
* **Carbs**: fruit, honey, rice, potatoes, etc.
* **Fats**: coconut oil, tallow/stearic, butter, etc.
* **Accoutrements (μ)**: garlic, onion, ginger, herbs, greens, seaweed, etc.

### 2.3 Supplements tracking

Optional module, off-by-default. Supports experimentation without daily overhead.

---

## 3) UI spec

### 3.1 Aesthetic direction

**Aesthetic:** **astral chronometer / solar ritual interface**
**Signature element:** **day timeline + solar arc** (sunrise → sunset) encoding time-of-day compliance and “protocol windows.”

### 3.2 Primary mobile interaction model

**Home (Today)** = one “day canvas”:

* Horizontal **timeline** from **Day Start** to **Day End** (supports wrap-around)
* Segmented: **FTN**, **Lunch**, **Dinner**, **Late**
* Tap a segment → opens **segment sheet**
* Segment shows bubble counts: **P / C / F / μ**
* Segment shows issue glyphs:

  * **×** = collision (effective: auto or manual)
  * **⚠** = seed oils = yes
  * **◎** = high-fat meal = yes
* **Now marker** + current segment highlight
* Background sky shifts (night/dawn/day/dusk) using sunrise/sunset (**manual** or **auto**)

**Quick actions (Home)**

* **Undo** (reverts last chip toggle/flag change; snackbar)
* **Repeat last** (long-press a segment to copy most recent logged segment into it)
* **Copy yesterday** (overflow menu; supports “entire day” or specific segments)
* Daily toggles cluster: **Move pre-lunch**, **Training**, **High-fat day**
* Signals: **Energy / Mood / Cravings** dots

### 3.3 Segment editor sheet (tap segment)

For the selected segment:

* **FTN segment only:** **FTN mode** segmented control (FTN / Lite / Off)
* Chip grids:

  * **Proteins**
  * **Carbs**
  * **Fats**
  * **Accoutrements (μ)**
* Chip grid layout (per category):

  * **Pinned row** (starred items)
  * **Recents row** (computed from last N uses)
  * Main grid (includes archived items only in “manage” mode)
  * **Search/typeahead** with inline “Add item”
* Flags:

  * **Collision**: Auto / Yes / No (default = Auto)
  * **Seed oils**: — / None / Yes (manual, quick)
  * **High-fat meal**: Auto / Yes / No (default = Auto)
  * **Segment status**: Unlogged / None / Logged

    * **None** = explicitly no food in this segment (clears selections)
* **Segment notes** (short)

**One-hand ergonomics**

* Large tap targets, bottom-sheet controls anchored to thumb zone.
* Long-press a chip to toggle **Pinned** (or open chip context menu).

### 3.4 Review + History + Backup

**Tabs (recommended):** Today / History / Review / Settings

**History**

* List shows:

  * date
  * unique diversity counts aggregated across the day (P/C/F/μ)
  * issue icons if any segment had them (**×**, **⚠**, **◎**)
* Tap day → day detail (segments + notes + signals)

**Review (Weekly Review 2.0)**

* weekly unique counts (P/C/F/μ)
* “missing roster items” list (least-used / unused)
* collision/seed-oil frequency
* FTN frequency summary (phase-aware)
* **coverage matrix** (days × categories; tap cell → drill-down)
* “next rotation picks” (least-recently-used suggestions)
* simple local-only **correlations** (see §9)

**Backup**

* Export:

  * **JSON**
  * **Encrypted JSON** (optional)
  * **CSV** (analysis in Sheets)
* Import:

  * validate → choose **Merge** or **Replace**
  * default: **Merge** (non-destructive)

### 3.5 Settings

**Time model**

* Day start/end, segment boundaries
* **Sun mode**: Manual / Auto
* Focus mode: Full / Now-fade

**Phase**

* **Strict / Maintenance / Advanced**
* Affects review targets + insights copy only (never blocks logging)

**Rosters**

* Add/edit items per category
* **Rename** (preserves history via stable IDs)
* **Archive** (hide from selection, keep in history)
* **Tags** (optional; powers heuristics + insights)
* **Aliases** (optional; powers search/typeahead)
* **Pinned** toggles

**Privacy**

* App lock: Off / On
* Home redaction: counts-only (hide labels + notes on Home)
* Export default: JSON / Encrypted JSON

**Sync (default: hosted)**

* Status: **Idle / Syncing / Offline / Error**
* Actions: **Sync now**, **Copy Sync Link**, **Paste Sync Link**, **Reset sync space**
* Optional: enable **E2EE** (passphrase) so the server stores ciphertext only
* Advanced: pause sync, endpoint override (dev)

**Diagnostics**

* storage mode (IndexedDB vs fallback)
* persistent storage status
* schema version + app version
* snapshot list (restore / delete)
* “Create snapshot now”

---

## 4) Data model spec

### 4.1 Storage strategy

**Hosted sync by default** (same-origin) with an **offline-first local cache**:

* **Remote store (same-origin)**: durability anchor + multi-device convergence. Used to bootstrap new devices and recover after cache loss.
* **IndexedDB** (local cache): primary read/write path for UI responsiveness and offline operation. Holds a persistent **outbox** for queued uploads.
* fallback: localStorage (legacy/compat only; limited offline cache)

**Durability + offline**

* Local writes always commit to the cache first (the **≤10s** rule stays intact).
* A background replicator drains the outbox to the server with retry (**exponential backoff + jitter**). Failures never block logging.
* Attempt **persistent storage** (`navigator.storage.persist()`); surface result in Diagnostics.
* Create automatic **pre-import** and **pre-migration snapshots** (ring buffer, keep last 7).
* Create a **pre-sync snapshot** before applying large remote pulls or destructive sync resets.

### 4.2 Canonical schema (v4)

```ts
// Canonical, zero-padded for sorting + stable exports: YYYY-MM-DD
type DateKey = `${number}-${string}-${string}`;

type SegmentId = "ftn" | "lunch" | "dinner" | "late";

type SeedOil = "" | "none" | "yes";
type FtnMode = "" | "ftn" | "lite" | "off";

// Computed + override tri-state. "" treated as "auto" for legacy compatibility.
type Tri = "" | "auto" | "yes" | "no";

type SegmentStatus = "" | "unlogged" | "none" | "logged";
type Signal = "" | "1" | "2" | "3" | "4" | "5";

// Monotonic merge clock for cross-device ordering.
// Format: "<unix_ms>:<counter>:<actor>"
type Hlc = string;
type ActorId = string;          // stable per-install identifier (Meta.installId)

// Hosted sync (same-origin). "" treated as default for legacy compatibility.
type SyncMode = "" | "hosted" | "off";
type SyncStatus = "" | "idle" | "syncing" | "offline" | "error";
type SyncEncryption = "" | "none" | "e2ee";

type ItemId = string;   // uuid (stable identity)
type ItemTag = string;  // e.g. "carb:starch", "carb:fruit", "fat:seed_oil"

interface RosterItem {
  id: ItemId;
  label: string;
  aliases: string[];     // search synonyms
  tags: ItemTag[];       // powers heuristics + explainable insights
  pinned: boolean;       // favorites
  archived: boolean;     // hidden from selection, preserved for history
  tsCreated: string;     // ISO
  tsUpdated: string;     // ISO
}

interface SegmentLog {
  ftnMode?: FtnMode;     // FTN segment only

  status: SegmentStatus;

  proteins: ItemId[];
  carbs: ItemId[];
  fats: ItemId[];
  micros: ItemId[];

  collision: Tri;        // effective: auto unless overridden
  seedOil: SeedOil;      // manual
  highFatMeal: Tri;      // effective: auto unless overridden

  notes: string;

  tsFirst?: string;      // set on first user touch (wall-clock; UX only)
  tsLast?: string;       // set on edits (wall-clock; UX only)

  hlc?: Hlc;             // merge clock (monotonic across devices)
  actor?: ActorId;       // last writer (tie-break + diagnostics)

  rev: number;           // monotonic per-segment revision
}

interface SupplementsLog {
  mode: "" | "none" | "essential" | "advanced";
  items: ItemId[];       // optional supplement roster (separate category or reuse tags)
  notes: string;
  tsLast?: string;
}

interface DayLog {
  segments: Record<SegmentId, SegmentLog>;

  movedBeforeLunch: boolean;
  trained: boolean;

  highFatDay: boolean;

  supplements?: SupplementsLog;

  energy: Signal;
  mood: Signal;
  cravings: Signal;

  notes: string;

  tsCreated: string;
  tsLast: string;

  hlc?: Hlc;             // merge clock (monotonic across devices)
  actor?: ActorId;       // last writer (tie-break + diagnostics)

  rev: number;           // monotonic per-day revision
}

interface Settings {
  // wall-clock HH:MM in device local timezone
  dayStart: "HH:MM";
  dayEnd: "HH:MM";
  ftnEnd: "HH:MM";
  lunchEnd: "HH:MM";
  dinnerEnd: "HH:MM";

  focusMode: "full" | "nowfade";

  // Solar visuals
  sunMode: "manual" | "auto";
  sunrise: "HH:MM";      // manual or fallback
  sunset: "HH:MM";       // manual or fallback
  lastKnownLat?: number; // local-only; used when sunMode=auto
  lastKnownLon?: number;

  // Guidance only
  phase: "" | "strict" | "maintenance" | "advanced";

  // Hosted sync (default). Secrets (auth token / passphrase) are stored outside TrackerState.
  sync: {
    mode: SyncMode;          // default "hosted"
    endpoint: string;        // e.g. "/api/sync/v1" (same-origin by default)
    spaceId?: string;        // opaque namespace id (share via Sync Link)
    encryption: SyncEncryption; // default "none"; "e2ee" requires passphrase entry
    pushDebounceMs: number;  // coalesce writes (default ~1500ms)
    pullOnBoot: boolean;     // default true
  };

  // Optional privacy hardening
  privacy: {
    appLock: boolean;
    redactHome: boolean;
    exportEncryptedByDefault: boolean;
  };
}

interface Rosters {
  proteins: RosterItem[];
  carbs: RosterItem[];
  fats: RosterItem[];
  micros: RosterItem[];
  supplements?: RosterItem[]; // optional module
}

interface InsightsState {
  // UI/rules-engine state only (e.g., dismissals). Keeps insights non-naggy across reloads/devices.
  dismissed: Record<string, string>; // insightKey -> dismissedAt ISO
  tsLast?: string;
}

interface Snapshot {
  id: string;            // uuid
  ts: string;            // ISO
  label: string;         // "Pre-import", "Pre-migration", "Pre-sync", "Manual"
  payload: string;       // serialized export (plain JSON) for restore
}

interface Meta {
  version: 4;

  installId: ActorId;    // stable per-install identifier
  appVersion?: string;   // optional build/version string

  storageMode: "idb" | "localStorage";
  persistStatus: "" | "unknown" | "granted" | "denied";

  // Non-secret sync status (safe to export).
  sync?: {
    mode: SyncMode;
    status: SyncStatus;
    lastSyncTs?: string;     // ISO
    lastError?: string;      // human-readable
    lastPullHlc?: Hlc;
    lastPushHlc?: Hlc;
    pendingOutbox?: number;  // queued ops count
  };

  lastSnapshotTs?: string;
}

interface TrackerState {
  version: 4;
  meta: Meta;

  settings: Settings;
  rosters: Rosters;

  insights: InsightsState;

  logs: Record<DateKey, DayLog>;
}
```

**Note:** hosted sync credentials (e.g. bearer token) and any E2EE passphrase are stored outside `TrackerState` and must be excluded from plain JSON exports.

### 4.3 Migration strategy (v1/v2/v3 → v4)

**Key requirement:** preserve interpretability and minimize user-visible surprises.

* v3 strings → v4 IDs:

  * create `RosterItem` for each roster label; assign **uuid**
  * build label→id map (case-insensitive normalization)
  * convert segment arrays from labels to IDs
  * any log label missing from roster → create a new roster item (unarchived) to avoid data loss
* Default tags:

  * ship sensible tags for default rosters (esp. carbs: **carb:starch** vs **carb:fruit**)
  * user can edit tags later; tags are guidance, not law
* Pre-migration snapshot:

  * create **Snapshot("Pre-migration")** before writing v4 state

---

## 5) Persistence + import/export spec

### 5.1 Persistence adapter

Implement a small **StorageAdapter** API (no build chain):

* `loadState(): Promise<TrackerState>`
* `saveDay(dateKey, dayLog): Promise<void>` (primary write path)
* `saveSettings(settings): Promise<void>`
* `saveRosters(rosters): Promise<void>`
* `saveInsights(insights): Promise<void>`
* `listSnapshots(): Promise<Snapshot[]>`
* `saveSnapshot(snapshot): Promise<void>`
* `restoreSnapshot(snapshotId): Promise<void>`
* `deleteSnapshot(snapshotId): Promise<void>`

**IndexedDB layout (recommended)**

* `meta` store (single)
* `settings` store (single)
* `sync_credentials` store (single; **not exported**) — bearer token / space join info
* `rosters` store (single)
* `insights` store (single)
* `logs` store keyed by `DateKey`
* `snapshots` store keyed by `Snapshot.id`
* `outbox` store (queued remote ops; coalesced by key)

### 5.2 Import

Import must be **validated**, **non-destructive**, and **merge-aware**.

**Flow**

1. Parse + validate (schema version, required fields)
2. Auto-create **Snapshot("Pre-import")**
3. Choose:

   * **Merge** (default)
   * **Replace**
4. Commit via IndexedDB transaction

**Merge semantics**

* Per-day merge: union logs by `DateKey`
* Per-segment resolution:

  * prefer higher `hlc` when present; fallback to `(rev, tsLast)` for legacy
  * if both touched and disjoint selections, optionally union arrays (configurable; default: winner-takes-segment)
* Roster merge:

  * match by `id` first
  * optional **dedupe by label** (case-insensitive) to prevent duplicates when combining installs

### 5.3 Export

**Plain JSON export**

* `TrackerState` + `exportedAt` + `appVersion`
* Does **not** include sync credentials (bearer tokens) or any E2EE passphrase

**Encrypted export (optional)**

* Use **WebCrypto AES-GCM**
* Derive key from passphrase via **PBKDF2** (salted)
* Export payload includes: algorithm params, salt, iv, ciphertext

**CSV export**

* One row per day:

  * date, phase, signals, toggles, issue counts
  * per-segment item labels delimited (e.g., `|`)
  * computed effective flags (collision/high-fat meal)

### 5.4 Hosted sync (default, same-origin)

Hosted sync is the **default** persistence mode. The app is **offline-first** by design: it renders from the local cache immediately, then converges with the server in the background.

#### 5.4.1 Sync Space + credentials

A Sync Space scopes data on the server:

* `spaceId` — opaque namespace id (shareable)
* `authToken` — high-entropy bearer credential (**stored locally only; never exported**)

On first run, the app creates (or lazily allocates) a Sync Space automatically. To join another device, the user pastes a **Sync Link** (contains `spaceId` + `authToken`, and optionally an E2EE hint).

#### 5.4.2 Remote data model (incremental, partition-aligned)

Remote storage mirrors the local partitions for efficiency:

* `meta`
* `settings`
* `rosters`
* `insights`
* `logs/<DateKey>`
* `snapshots/<id>` (optional)

Avoid a full-state blob as the primary sync primitive; it scales poorly as history grows.

#### 5.4.3 API semantics (v1, same-origin)

* `GET /api/sync/v1/index` → manifest `{ serverHlc, items: [{ key, hlc, etag, size }] }`
* `GET /api/sync/v1/item/:key` → value (with `ETag`)
* `PUT /api/sync/v1/item/:key` → upsert with `If-Match` (optimistic concurrency)
* `POST /api/sync/v1/batch` → batch upsert (preferred for performance)
* Optional: `POST /api/sync/v1/create` → returns `{ spaceId, authToken }`

Correctness requirements:

* All `/api/sync/*` responses set `Cache-Control: no-store`.
* Writes accept an `Idempotency-Key` to make retries safe.

#### 5.4.4 Sync algorithm (fast UI, durable replication)

**Hot path (always fast):**

1. Write changes to the local cache (IndexedDB).
2. Stamp updates with `hlc` + `actor` and bump `rev`.
3. Enqueue an outbox op keyed by record key (coalesce latest-wins).
4. Schedule a debounced push (never block the UI).

**On boot (and periodically when online):**

1. Load cached state and render immediately.
2. Pull `index` and fetch only changed keys (by `hlc`/etag).
3. Merge remote into local using merge rules below.
4. Persist merged local state.
5. Drain outbox with batching and retry.

Reliability:

* persistent outbox
* **exponential backoff + jitter**
* single-tab leadership via `BroadcastChannel` (avoid races across tabs)

Offline behavior:

* If offline, the app remains fully usable (cache + outbox grows).
* When connectivity returns, the outbox drains and devices converge.

#### 5.4.5 Merge rules (hosted sync)

Ordering is `hlc`-first:

* Prefer the record with the greater `hlc`.
* If `hlc` is missing (legacy), fall back to `(rev, tsLast)`.
* If still tied, compare `actor` lexicographically.

#### 5.4.6 Optional E2EE for hosted sync

If enabled, encrypt payloads client-side before upload:

* **AES-GCM** for encryption, **PBKDF2** for passphrase-derived keys (re-use encrypted export code).
* Store only ciphertext + params on the server.
* (Hardening) bind ciphertext to `{spaceId, key}` using AEAD associated data to prevent record swapping.

E2EE is optional because it adds key-management UX; if enabled, the server becomes a blind store.

---

## 6) Reference architecture (still “vanilla”)

### 6.1 Code organization (ES modules)

No framework, no bundler. Use `<script type="module">`.

* `domain/`

  * **time model** (protocol day mapping)
  * **aggregators** (weekly counts, missing list, correlations)
  * **heuristics** (collision/highFatMeal auto, rotation picks)
  * **insights rules engine**
* `storage/`

  * IndexedDB adapter
  * localStorage fallback
  * migration + import validation
  * export/encryption
* `ui/`

  * render functions + minimal templating
  * event bindings (no business logic)
* `app/`

  * boot + routing + tiny store

### 6.2 State management

Use a tiny **unidirectional data flow**:

* UI dispatches `action`
* `reducer(state, action)` returns new state (pure)
* persistence layer writes minimal deltas (day/settings/rosters)
* renderer updates only affected parts (selectors)

### 6.3 Type safety without TypeScript build

Use `// @ts-check` + JSDoc typedefs for editor correctness.

---

## 7) Time model spec (protocol day)

### 7.1 Definitions

* **Protocol day**: the interval `[dayStart, dayEnd)` in device local timezone.
* **Wrap-around day**: if `dayEnd <= dayStart`, then `dayEnd` is on the next calendar day.
* **DateKey**: local calendar date of the protocol day’s **dayStart**.
* **activeDay(now)**: the protocol day interval that contains `now` (so after midnight but before `dayEnd`, active day is “yesterday” by DateKey).

### 7.2 Boundary lifting

Convert each HH:MM to minutes `m ∈ [0, 1439]`. Create a monotonic timeline:

* Let `start = dayStartMinutes`
* Lift any boundary `b`:

  * `x = b`
  * if `x < start` then `x += 1440`
* Define `end` similarly (and ensure `end > start` by lifting if wrap-around)
* Segment windows:

  * FTN: `[start, ftnEnd)`
  * Lunch: `[ftnEnd, lunchEnd)`
  * Dinner: `[lunchEnd, dinnerEnd)`
  * Late: `[dinnerEnd, end)`

### 7.3 DST policy

Settings are **wall-clock minutes**. If a wall-clock time is invalid/ambiguous due to DST:

* clamp deterministically to the nearest representable time in the direction that preserves monotonic boundaries
* document behavior in Diagnostics (“DST clamp applied” when detected)

### 7.4 Solar arc clamping

If sunrise/sunset fall outside `[start, end)`, clamp solar arc to the visible timeline so the UI never breaks.

### 7.5 Auto sunrise/sunset (optional)

If `sunMode=auto`:

* request geolocation permission (user-driven action only)
* compute sunrise/sunset on-device (no network)
* store last-known lat/lon locally
* fallback to manual sunrise/sunset if permission denied

---

## 8) Computed + override heuristics

### 8.1 Effective values

For each segment:

* `effectiveCollision`:

  * if `collision` = `yes/no` → use it
  * else compute conservatively from tags (see below)
* `effectiveHighFatMeal`:

  * if `highFatMeal` = `yes/no` → use it
  * else compute from tags + selections
* `seedOil` remains manual, but can show a *hint* if any selected fat is tagged **fat:seed_oil** or **fat:unknown**

### 8.2 Recommended tag conventions

Minimal tags that unlock high-value logic:

* Carbs:

  * **carb:starch** (rice, potato)
  * **carb:fruit** (fruit)
  * **carb:sugar** (honey)
* Fats:

  * **fat:dense** (tallow, butter, coconut oil)
  * **fat:seed_oil** (if user wants explicit)
  * **fat:unknown** (restaurant / mystery oil)
* Optional:

  * protein classes, micro categories (only if desired)

### 8.3 Conservative collision auto rule (default)

Mark collision = yes only if:

* segment has ≥1 **fat:dense** AND ≥1 **carb:starch**
  (Do *not* auto-flag fruit + fat; leave that to user judgment.)

---

## 9) Weekly Review 2.0

### 9.1 Outputs

Per week (configurable week start):

* Unique diversity counts (P/C/F/μ)
* Missing list:

  * never used this week
  * least-recently-used (LRU) suggestions
* Issue frequency:

  * collision days, seed oil days
* FTN summary:

  * strict/lite/off counts
  * phase-aware targets display (guidance only)

### 9.2 Coverage matrix

Display a matrix: rows = days, columns = categories P/C/F/μ plus flags.

* each cell shows count or presence indicator
* tap to drill into that day/segment

### 9.3 Rotation picks

For each category:

* compute **LRU** items from last N days/weeks
* suggest 1–2 “next picks” to increase variety with minimal effort

### 9.4 Correlations (local-only, simple)

Compute lightweight comparisons (no heavy stats, no overclaiming):

* avg cravings on collision vs non-collision days
* avg energy on FTN strict vs off days
* seed-oil days vs non-seed-oil days

Show as “Observed in last X days” with sample size, not as conclusions.

---

## 10) Explainable protocol insights rules engine

### 10.1 Requirements

* on-device **rules engine** (no cloud, no AI dependency)
* each insight includes a short **reason** (“triggered by tags + selections + flags”)
* phase-aware language
* dismissible (per day/week) to avoid nag loops

### 10.2 Example rules (illustrative)

* If training logged AND lunch has no **carb:starch** → suggest starch window
* If collision occurred today → tomorrow suggestion: separate starch + dense fat
* If μ count is 0 for week → pick 2 defaults (user-chosen pinned μ)

Default placement:

* show insights in **Review** by default
* optional “Today nudge” card if enabled

---

## 11) Tech stack + PWA reliability

### 11.1 Minimal stack (v4)

* **Vanilla HTML/CSS/JS**
* **ES Modules**
* `// @ts-check` + JSDoc
* **PWA** manifest + service worker
* Storage: **IndexedDB** primary + fallback

### 11.2 Service worker strategy

* Versioned **app-shell precache** (HTML/CSS/JS/fonts/icons)
* Runtime caching for optional assets (if any)
* Explicit update UX:

  * detect new SW → show “Update available”
  * user taps → `skipWaiting` + reload
* Never silently break offline

### 11.3 Offline fonts

Bundle 2 WOFF2 fonts:

* display serif for headers/brand
* body UI font
  Preload + cache in app shell.

---

## 12) What’s implemented vs what remains

### 12.1 Implemented baseline (DONE)

**v3 — Solar Log (current baseline)**
Implements:

* segmented day UI (FTN/Lunch/Dinner/Late)
* solar arc + time-reactive background
* per-segment diversity (P/C/F/μ)
* per-segment flags: collision, seed oils
* daily toggles: move pre-lunch, training, high-fat day
* daily signals: energy/mood/cravings
* notes (daily + per segment)
* settings for segment boundaries + sunrise/sunset
* roster editing (add/remove)
* history list + export/import JSON
* migration from earlier builds

### 12.2 v4 implementation backlog (prioritized)

**P0 — correctness + durability**

1. **Protocol day time model** (wrap-around + activeDay + DST clamp policy)
2. **IndexedDB-first persistence** + fallback
3. **Roster IDs + tags** migration (v3 strings → v4 items)
4. **Import merge + snapshots** (pre-import/pre-migration restore)
5. **Weekly Review 2.0** (coverage matrix + rotation picks)

**P1 — speed + delight**
6. **Pinned + Recents + Search/typeahead**
7. **Undo + Repeat last segment**
8. **Computed + override** for collision/high-fat meal (conservative defaults)
9. **Explainable rules engine insights** (Review-first)

**P2 — privacy + portability**
10. **Encrypted export** (WebCrypto AES-GCM)
11. **CSV export**
12. **App lock + privacy blur + home redaction**

**P3 — optional future**
13. Opt-in cloud sync (Supabase/Worker) using per-day rows and segment `rev/tsLast` merge

---

## 13) QA / Acceptance checklist

### Time model

* [ ] Boundaries lift monotonically (wrap-around supported)
* [ ] **activeDay(now)** correct after midnight when wrap-around
* [ ] Now marker clamps inside timeline
* [ ] Solar arc clamps if sunrise/sunset outside protocol day
* [ ] DST clamp policy deterministic and documented

### Logging

* [ ] Chip toggles update instantly
* [ ] Segment bubble counts update immediately
* [ ] Effective flags display correctly (Auto vs override)
* [ ] Segment `tsFirst` set once on first touch
* [ ] `rev` increments only on changes

### Review

* [ ] Weekly counts correct for P/C/F/μ uniques
* [ ] Coverage matrix drill-down accurate
* [ ] Rotation picks are least-recently-used and stable
* [ ] Correlations show sample size and never overclaim

### Backup + import/export

* [ ] Export produces valid JSON with version/meta
* [ ] Encrypted export decrypts correctly with passphrase
* [ ] Import validates before writing
* [ ] Merge preserves data; replace requires explicit confirmation
* [ ] Snapshot restore is one-tap and reliable

### PWA reliability

* [ ] Offline app-shell loads reliably after install
* [ ] Update flow is user-visible and non-destructive
* [ ] Diagnostics shows storage mode + persist status + schema/app version

### UX friction

* [ ] Today screen loads < 1s on mid-range mobile
* [ ] Main flow ≤ 10 seconds
* [ ] No forced forms, no required fields, no nag loops

---

### Current baseline download

* [shredmaxx-tracker-pwa-v3.zip](sandbox:/mnt/data/shredmaxx-tracker-pwa-v3.zip)

If you want, I can also collapse this into a **v4 delta spec** (only what changes from v3) or translate the plan into a concrete file-level work plan (modules, functions, and data migrations) while still staying framework-free.

