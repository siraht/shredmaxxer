# Solar Log vNext Unified Implementation Spec

**Codename:** **Solar Log**  
**Product:** Shredmaxx / Solar Log (PWA; mobile + desktop)  
**This spec supersedes:** `spec_v5.md` and consolidates the UI overhaul (mockups) + hosted-sync plan into a single source of truth.

Built by unifying:
- `spec_v5.md` (v4 plan spec; canonical product + data model)  
- `README.md` (current codebase posture: v3 UI baseline + v4 logic; hosted sync default + IDB cache)  
- `hosted-storage-plan.md` (storage/sync impact analysis and SW constraints)  
- UI mockups: `home.html`, `segmenteditor.html`, `archive.html`, `metrics.html`  

---

## Table of contents

- [0) Status, scope, and invariants](#sec-0-status)
- [1) Product intent and constraints](#sec-1-intent)
- [2) Protocol-to-tracking mapping](#sec-2-protocol)
- [3) UX and UI spec](#sec-3-ui)
  - [3.1 Visual system](#sec-3-1-visual)
  - [3.2 App shell](#sec-3-2-shell)
  - [3.3 Screens](#sec-3-3-screens)
  - [3.4 Components](#sec-3-4-components)
  - [3.5 Accessibility](#sec-3-5-a11y)
  - [3.6 Using the mockup HTML files](#sec-3-6-mockups)
- [4) Data model (canonical schema)](#sec-4-data)
- [5) Time model](#sec-5-time)
- [6) Computed + override heuristics](#sec-6-heuristics)
- [7) Persistence architecture (offline-first cache)](#sec-7-persist)
- [8) Hosted sync architecture (same-origin)](#sec-8-sync)
- [9) Import/export, snapshots, and recovery](#sec-9-backup)
- [10) Derived indexes and review cache](#sec-10-indexes)
- [11) App runtime architecture (store, render, events)](#sec-11-runtime)
- [12) Service worker and caching](#sec-12-sw)
- [13) Privacy and security](#sec-13-privacy)
- [14) Performance budgets](#sec-14-perf)
- [15) Testing and acceptance checklist](#sec-15-tests)
- [16) Implementation milestones](#sec-16-milestones)
- [Appendix A: Tag conventions](#sec-app-a-tags)
- [Appendix B: Migration notes](#sec-app-b-migrations)
- [Appendix C: Mockup-to-component mapping](#sec-app-c-mockmap)

---

<a id="sec-0-status"></a>
## 0) Status, scope, and invariants

### 0.1 What’s changing
This iteration integrates **two major changes at the same time**:

1) The new functional spec requirements already described in `spec_v5.md` (segmented-day model, hosted sync, review, privacy, etc.).  
2) A **full UI/UX overhaul** based on the supplied HTML mockups (industrial/astral “solar chronometer” aesthetic, bottom sheet editor, matrix review UI).

### 0.2 Non-negotiable invariants
These invariants must hold across all implementation choices:

- **Offline-first cache:** UI reads/writes local cache first. Logging must work offline.  
- **Hosted sync durability:** when a same-origin sync server exists, the app converges in background using pull/merge/push (never blocks logging).  
- **No front-end build chain:** ship as vanilla HTML/CSS/JS with ES modules and optional JSDoc `// @ts-check`.  
- **Presence-based tracking:** no calories/macros/grams.  
- **≤ 10 second logging loop:** open → tap segment → tap chips/flags → done.

> **Comment (tricky):** The mockups include Tailwind Play CDN + Google Fonts + Material Symbols fonts. This spec forbids those runtime dependencies for core UI. See §3.6.

---

<a id="sec-1-intent"></a>
## 1) Product intent and constraints

### 1.1 Purpose
Provide a fast, personal tool to execute Shredmaxx levers that matter most:

- Segmented day: **FTN → Lunch → Dinner → Late**
- Daily toggles: **Move pre‑lunch**, **Training**
- Flags: **HFHC collision**, **seed oils/unknown oils**, **high‑fat meal/day**
- Food diversity presence per segment:
  - **Proteins / Carbs / Fats / Accoutrements (μ)**
- Signals: **Energy / Mood / Cravings (1–5)**
- Notes (short, optional)

### 1.2 Non-goals (explicit)
To prevent “nutrition app bloat”:

- calories/macros/grams
- weigh-ins, body metrics
- full meal logging, ingredients
- micronutrient quantities
- perfect protocol enforcement (this is tracking + feedback, not policing)

### 1.3 UX north star rule
Every log action must be doable in **≤ 10 seconds** (median case).

Speed principles:
- Pinned + recents beat scrolling.
- Undo reduces fear and increases compliance.
- Tap-first flows; no form-first flows.

### 1.4 Privacy posture
Default is frictionless and **hosted-sync-first** with an **offline-first local cache** (logging always reads/writes locally and syncs in the background). Optional hardening:

- app lock (passcode)
- privacy blur when backgrounded
- home redaction (counts-only)
- encrypted export (AES‑GCM)
- optional hosted-sync E2EE (ciphertext-only server)

---

<a id="sec-2-protocol"></a>
## 2) Protocol-to-tracking mapping

### 2.1 Core levers to track (fast)
1. **FTN mode** (FTN segment only): strict / lite / off  
2. **Move pre‑lunch** (day toggle)  
3. **Training** (day toggle)  
4. **HFHC collision** (computed + override; segment-level)  
5. **Seed oils / unknown oils** (manual field; with optional hints)  
6. Diversity presence: **P/C/F/μ** per segment  
7. **High-fat meal** (computed + override; segment-level)  
8. **High-fat day** (computed + override; day-level)  
9. **Signals**: energy/mood/cravings  
10. Notes (segment + day)

### 2.2 Diversity model (presence)
An item is either present or absent in a segment. No quantities.

Categories:
- Proteins (beef, eggs, fish…)
- Carbs (fruit, rice, honey…)
- Fats (tallow, butter…)
- Accoutrements (μ) (garlic, herbs, greens…)

### 2.3 Supplements tracking (optional)
Optional module, off-by-default. Supports experimentation without daily overhead.

---

<a id="sec-3-ui"></a>
## 3) UX and UI spec

<a id="sec-3-1-visual"></a>
### 3.1 Visual system (local-first; no CDN)

#### 3.1.1 Visual direction
**Aesthetic:** astral chronometer / industrial terminal  
**Signature element:** solar arc + segmented timeline

#### 3.1.2 Fonts (local)
Bundle exactly two WOFF2 fonts:
- UI: Space Grotesk
- Mono: JetBrains Mono

Preload + precache fonts in the app shell.

#### 3.1.3 Icon system (local)
Use internal SVG icons (sprite or inline templates). Do not depend on Material Symbols font CDN.

#### 3.1.4 Tokens
Define CSS variables under `:root` (and `:root[data-accent="intel"]` if you want a review accent mode):

- `--color-bg`, `--color-surface`, `--color-panel`, `--color-border`
- `--color-primary` (recommended default: orange `#FF5100`)
- category accents:
  - protein `--color-protein`
  - carb `--color-carb`
  - fat `--color-fat`
  - micro `--color-micro`
- spacing scale, border radii, hard shadows

> **Comment:** The metrics mockup uses cyan as primary. Either unify on orange globally or support `data-accent` to swap only `--color-primary`, keeping the rest consistent.

#### 3.1.5 Component CSS
Create stable component classes:
- `.card`, `.card--active`, `.card--ghost`
- `.chip`, `.chip--selected`, `.chip--archived`
- `.pill`, `.pill--status`, `.pill--warn`
- `.sheet`, `.sheet__header`, `.sheet__body`, `.sheet__footer`
- `.tri` (segmented tri-state controls)
- `.grid-bg`, `.noise`, `.scanlines` (lightweight effects)

---

<a id="sec-3-2-shell"></a>
### 3.2 App shell

#### 3.2.1 Shell DOM
Single root `#app` with consistent layers:

- `header` (TopBar)
- `main` (RouteOutlet)
- `nav` (BottomNav / desktop rail)
- `#modal-root` (bottom sheet, dialogs)
- `#toast-root` (undo/snackbar)
- `#scrim` (modal backdrop + privacy blur overlay)

#### 3.2.2 Navigation
Primary tabs:
- Today
- History
- Review
- Settings

Map mockup labels:
- HOME → Today
- LOGS → History
- STATS → Review
- CFG → Settings

#### 3.2.3 Responsive behavior
- Mobile: centered column (~max 420–520px), bottom nav.
- Desktop: optional left rail; Review can be 2-column; History can be split list/detail.

---

<a id="sec-3-3-screens"></a>
### 3.3 Screens

#### 3.3.1 Today (Home)
Inspired by `home.html` layout.

**Must display:**
- solar arc hero (sunrise→sunset clamped to protocol day)
- current time + timezone
- sync status pill (Idle/Syncing/Offline/Error + outbox count)
- segment deck: FTN/Lunch/Dinner/Late

Per segment card:
- time window label
- segment status (Unlogged/None/Logged)
- counts: **P / C / F / μ**
- issue glyphs:
  - `×` collision effective yes
  - `⚠` seedOil yes
  - `◎` highFatMeal effective yes

Day controls:
- toggles: movedBeforeLunch, trained, highFatDay (Tri)
- signals: energy/mood/cravings
- quick actions: undo, repeat last, copy yesterday

**Remove from mockup:**
- KCAL, grams, macro gauges.

> **Comment:** Replace the mockup’s “macro gauges” block with a “counts gauges” block (P/C/F/μ), keeping the same visual rhythm.

#### 3.3.2 Segment Editor (Bottom Sheet)
Inspired by `segmenteditor.html` structure.

**Must support:**
- FTN-only: ftnMode segmented control (ftn/lite/off)
- per category: Selected row, Pinned row, Recents row, All grid
- search/typeahead with inline Add item
- tri-state flags:
  - collision: auto/yes/no
  - highFatMeal: auto/yes/no
  - seedOil: — / none / yes
- segment status tri:
  - unlogged / none / logged
  - choosing “none” clears selections
- segment notes (short)

**Ergonomics:**
- one-hand friendly thumb zone in footer
- long-press chip: pin/unpin; desktop: context menu

#### 3.3.3 History
Inspired by `archive.html` layout but content must match schema.

List rows must show:
- date + weekday
- aggregated unique counts across day: P/C/F/μ
- issue glyphs if present
- optional signal summary
- unsynced indicator if outbox pending

Day expanded / day detail must show:
- day toggles + signals + notes
- per segment summaries (status, counts, glyphs, notes indicator)
- edit buttons for segments

History also includes:
- search/filter by roster item, tag, flag.

#### 3.3.4 Day Detail (new)
Deep edit screen, useful on desktop:

- header: date, sync state, last edited
- day toggles + signals + notes
- segments table with edit actions (opens segment sheet)
- optional “copy from previous day” actions

#### 3.3.5 Review (Weekly Review 2.0)
Inspired by `metrics.html` (matrix + rotation queue), but must be explainable and grounded.

Must include:
- week selector (respects settings.weekStart)
- weekly unique counts (P/C/F/μ)
- coverage matrix (days × categories, drill-down)
- rotation picks (LRU per category)
- issue frequency (collision days, seed-oil days, high-fat days)
- FTN summary (ftn/lite/off counts)
- local-only correlations with sample size
- dismissible insights (rules engine w/ reasons)

Progressive render:
- render header + weekly counts immediately
- matrix + rotation computed quickly (or from week_index)
- correlations/insights computed via idle time

> **Comment:** Replace any pseudo-physiology copy (e.g., “glycogen stores at 85%”) with explainable statements tied to tracked data.

#### 3.3.6 Settings
Must include:

- Time model: dayStart/dayEnd + segment boundaries
- Sun mode: manual/auto; geolocation on user action only
- Phase: strict/maintenance/advanced (guidance only)
- Rosters manager: add/edit/rename/archive/tags/aliases/pinned, optional icon
- Privacy: app lock, blur on background, home redaction, export defaults
- Sync: status + sync now + copy/paste sync link + reset sync space + E2EE toggle
- Diagnostics: storage mode, persist status, schema/app version, outbox depth, last error, snapshots, audit log, safe mode state

---

<a id="sec-3-4-components"></a>
### 3.4 Component contracts

Agents must treat these as “UI API boundaries” to keep wiring clean.

#### 3.4.1 TopBar
Props:
- title/subtitle
- sync pill: status + pendingOutbox + lastSyncTs
- actions: back, settings, overflow

#### 3.4.2 BottomNav / Rail
Props:
- active route
- optional badge (pending outbox)

#### 3.4.3 SegmentCard
Props:
- segmentId + label
- window start/end
- status
- counts (P/C/F/μ)
- glyph flags (collision/seedOil/highFatMeal)
- onOpenEditor(dateKey, segmentId)

#### 3.4.4 SegmentEditorSheet
Props:
- segment VM (selected IDs, derived effective flags, notes)
- roster VM grouped by category (selected/pinned/recents/all)
- actions:
  - toggle item
  - set tri flag
  - set status
  - set notes
  - pin/unpin
  - search/add

#### 3.4.5 HistoryRow / DayCard
Props:
- dateKey, weekday
- day aggregates (unique counts, glyph flags)
- signals summary
- toggles summary
- onOpenDayDetail(dateKey)

#### 3.4.6 ReviewWeek
Props:
- week range
- weekly counts
- matrix cells + drilldown mapping
- rotation picks
- issue frequency
- correlations + sample sizes
- insights list

---

<a id="sec-3-5-a11y"></a>
### 3.5 Accessibility (must)
- keyboard navigation on desktop
- visible focus states
- icon buttons have aria-label
- bottom-sheet focus trap + Esc close + restore focus on close
- respect `prefers-reduced-motion`
- avoid text that relies purely on color (use glyphs + labels)

---

<a id="sec-3-6-mockups"></a>
### 3.6 Using the mockup HTML files

This section is **how agents should use the mockups** (`home.html`, `segmenteditor.html`, `archive.html`, `metrics.html`) to implement the UI overhaul without importing the mockups verbatim.

#### 3.6.1 What the mockups are (and are not)
- ✅ **They are:** the canonical reference for layout, spacing rhythm, component “vibe,” and interaction patterns (bottom sheet, matrix, timeline cards).  
- ❌ **They are not:** production-ready HTML/CSS; they currently depend on CDN Tailwind + Google Fonts + Material Symbols, and include non-spec content (macros/compliance).

#### 3.6.2 Mechanical adoption process (recommended)
1) **Copy structure, not dependencies**
   - Take the *semantic* DOM structure (sections, header/footer placements, card skeletons).
   - Strip all:
     - `<script src="https://cdn.tailwindcss.com...">`
     - `<link href="https://fonts.googleapis.com...">`
     - Material Symbols font usage
2) **Replace Tailwind classes with component classes**
   - Convert repeated class clusters into stable component classes (`.card`, `.chip`, `.pill`, `.sheet`, etc.).
   - Anything that’s truly one-off can remain as a small utility class, but avoid a “utility sprawl.”
3) **Tokenize colors + effects**
   - Extract colors from the mockups into CSS variables (primary, surfaces, borders, accents).
   - Convert noise/scanline effects into optional lightweight overlays (no large blur filters).
4) **Enforce spec data mapping**
   - Replace mockup placeholders that don’t exist in the schema:
     - KCAL/macros/grams → P/C/F/μ counts
     - “compliance %” → issue frequency + diversity counts (or remove)
     - wake/sleep/circadian extras → only if later added as explicit fields (not in this spec)
5) **Build component templates**
   - For each component (SegmentCard, ChipGrid, MatrixCell, etc.), create a render function that accepts a VM and outputs DOM.
6) **Run the spec completeness checklist**
   - For each screen, verify every required field from §4 and §3.3 is displayed and editable somewhere appropriate.

#### 3.6.3 File-by-file mapping
- `home.html` → Today screen shell, solar hero, segment deck, bottom nav, “hard shadow” card style.  
- `segmenteditor.html` → bottom sheet, chip-grid styling, sticky footer pattern (search + primary action).  
- `archive.html` → timeline list + expandable day cards styling; mechanical snap button feel.  
- `metrics.html` → weekly matrix styling + rotation queue styling + terminal “insights” panel (but replace copy).  

#### 3.6.4 “Keep / modify / drop” tables

**Home**
- Keep: solar arc hero, “now marker,” segment deck layout, bottom nav.
- Modify: macro gauges → counts gauges; chip “150g” labels removed.
- Drop: any calories/macros, any net/battery indicators that aren’t real.

**Segment editor**
- Keep: sheet structure, grid chips aesthetic, sticky footer layout.
- Modify: boolean toggles → tri-state controls; add segment status; add notes; add pinned/recents/selected sections.
- Drop: “LOG” implying commit-on-press if app persists instantly. (Use DONE/CLOSE; persist on each change.)

**Archive**
- Keep: timeline card layout, expand/collapse styling.
- Modify: replace wake/sleep/compliance with day aggregates + toggles/signals + segment summaries.
- Drop: “data corrupted” dramatization unless tied to real Safe Mode detection.

**Metrics**
- Keep: matrix styling, rotation queue list, terminal panel aesthetic.
- Modify: insights to be explainable, sample-size labeled, purely data-grounded.
- Drop: pseudo-physiology claims.

#### 3.6.5 Where to store the mockups in the repo
Keep the original mockup files as a stable reference for future UI work:

```
ui/mockups/
  home.html
  segmenteditor.html
  archive.html
  metrics.html
```

Do not ship these in production builds; treat them as design reference docs.

---

<a id="sec-4-data"></a>
## 4) Data model (canonical schema)

### 4.1 Core types
- DateKey: `YYYY-MM-DD` (protocol-day anchored)
- SegmentId: `ftn | lunch | dinner | late`
- Tri: `"" | "auto" | "yes" | "no"` ("" treated as legacy auto)
- SeedOil: `"" | "none" | "yes"`
- Signals: `"" | "1" | "2" | "3" | "4" | "5"`
- HLC: `<unix_ms>:<counter>:<actor>`

### 4.2 Canonical schema (vNext)
> **Note:** This is v4 schema with minor additions. It remains export-compatible and merge-safe, but includes a migration for `highFatDay` from boolean → Tri.

```ts
type DateKey = `${number}-${string}-${string}`; // YYYY-MM-DD
type SegmentId = "ftn" | "lunch" | "dinner" | "late";

type SeedOil = "" | "none" | "yes";
type FtnMode = "" | "ftn" | "lite" | "off";

type Tri = "" | "auto" | "yes" | "no";           // "" treated as "auto"
type SegmentStatus = "" | "unlogged" | "none" | "logged";
type Signal = "" | "1" | "2" | "3" | "4" | "5";

type Hlc = string;       // "<unix_ms>:<counter>:<actor>"
type ActorId = string;

type SyncMode = "" | "hosted" | "off";
type SyncStatus = "" | "idle" | "syncing" | "offline" | "error";
type SyncEncryption = "" | "none" | "e2ee";

type ItemId = string;
type ItemTag = string;

interface RosterItem {
  id: ItemId;
  label: string;
  aliases: string[];
  tags: ItemTag[];
  pinned: boolean;
  archived: boolean;

  // Optional UI enhancement (local + sync-safe)
  icon?: string;          // internal SVG icon id

  tsCreated: string;
  tsUpdated: string;
}

interface SegmentLog {
  ftnMode?: FtnMode;      // FTN segment only
  status: SegmentStatus;

  proteins: ItemId[];
  carbs: ItemId[];
  fats: ItemId[];
  micros: ItemId[];

  collision: Tri;
  seedOil: SeedOil;
  highFatMeal: Tri;

  notes: string;

  tsFirst?: string;
  tsLast?: string;

  hlc?: Hlc;
  actor?: ActorId;

  rev: number;
}

interface SupplementsLog {
  mode: "" | "none" | "essential" | "advanced";
  items: ItemId[];
  notes: string;
  tsLast?: string;
}

interface DayLog {
  segments: Record<SegmentId, SegmentLog>;

  movedBeforeLunch: boolean;
  trained: boolean;

  // UPDATED: Tri instead of boolean
  highFatDay: Tri;

  supplements?: SupplementsLog;

  energy: Signal;
  mood: Signal;
  cravings: Signal;

  notes: string;

  tsCreated: string;
  tsLast: string;

  hlc?: Hlc;
  actor?: ActorId;

  rev: number;
}

interface Settings {
  dayStart: "HH:MM";
  dayEnd: "HH:MM";
  ftnEnd: "HH:MM";
  lunchEnd: "HH:MM";
  dinnerEnd: "HH:MM";

  focusMode: "full" | "nowfade";

  sunMode: "manual" | "auto";
  sunrise: "HH:MM";
  sunset: "HH:MM";
  lastKnownLat?: number;
  lastKnownLon?: number;

  phase: "" | "strict" | "maintenance" | "advanced";

  weekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6;

  sync: {
    mode: SyncMode;
    endpoint: string;          // default "/api/sync/v1"
    spaceId?: string;
    encryption: SyncEncryption;
    pushDebounceMs: number;
    pullOnBoot: boolean;
  };

  privacy: {
    appLock: boolean;
    redactHome: boolean;
    exportEncryptedByDefault: boolean;
    blurOnBackground: boolean;
  };

  ui?: {
    accent?: "" | "orange" | "cyan";
    reduceEffects?: boolean;
  };
}

interface Rosters {
  proteins: RosterItem[];
  carbs: RosterItem[];
  fats: RosterItem[];
  micros: RosterItem[];
  supplements?: RosterItem[];
}

interface InsightsState {
  dismissed: Record<string, string>;
  tsLast?: string;
}

interface Snapshot {
  id: string;
  ts: string;
  label: string;
  payload: string;
}

interface Meta {
  version: 4;
  installId: ActorId;
  appVersion?: string;

  storageMode: "idb" | "localStorage";
  persistStatus: "" | "unknown" | "granted" | "denied";

  sync?: {
    mode: SyncMode;
    status: SyncStatus;
    lastSyncTs?: string;
    lastError?: string;
    lastPullHlc?: Hlc;
    lastPushHlc?: Hlc;
    pendingOutbox?: number;

    conflicts?: number;
    lastConflictTs?: string;
  };

  integrity?: {
    safeMode?: boolean;
    lastIntegrityCheckTs?: string;
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

### 4.3 Secrets
Sync credentials and E2EE passphrase must not appear inside `TrackerState`, and must not appear in plain exports.

Store secrets separately (e.g., `idb:sync_credentials`).

---

<a id="sec-5-time"></a>
## 5) Time model

Follow the formal protocol day model:

- protocol day anchored at `dayStart`
- supports wrap-around (`dayEnd <= dayStart`)
- `activeDay(now)` resolves correctly after midnight
- boundaries lift to a monotonic timeline
- deterministic DST clamp
- solar arc clamps within protocol day

> **Comment (tricky):** DST invalid/ambiguous local times must not break boundary ordering. Clamp in a deterministic direction that preserves monotonic segment windows. Surface “DST clamp applied” in Diagnostics.

---

<a id="sec-6-heuristics"></a>
## 6) Computed + override heuristics

### 6.1 Effective collision
- If `collision` is manual yes/no → use it.
- Else compute conservatively based on tags:
  - collision=yes only if segment includes ≥1 fat tagged `fat:dense` AND ≥1 carb tagged `carb:starch`.

### 6.2 Effective high-fat meal
- If `highFatMeal` manual yes/no → use it.
- Else compute from fat tags and/or selection counts (keep conservative and explainable).

### 6.3 Effective high-fat day
- `DayLog.highFatDay` is Tri:
  - if yes/no → use override
  - if auto/"" → compute from segment effective highFatMeal flags (or fat density frequency)

### 6.4 Seed oil hints
- `seedOil` is manual field, but UI may show a hint if any selected fat is tagged:
  - `fat:seed_oil` or `fat:unknown`

### 6.5 Rotation picks (LRU)
For each category:
- compute least-recently-used items over a configurable window
- suggest 1–2 “next picks” to improve variety

### 6.6 Correlations (local-only)
Compute lightweight differences (no heavy stats):
- cravings on collision vs non-collision days
- energy on FTN vs off days
- seed-oil days vs non-seed-oil days

Must always show sample size and phrasing “Observed in last X days”.

---

<a id="sec-7-persist"></a>
## 7) Persistence architecture (offline-first cache)

### 7.1 Storage adapter interface
Implement the small adapter API:

- `loadState()`
- `saveDay(dateKey, dayLog)`
- `saveSettings(settings)`
- `saveRosters(rosters)`
- `saveInsights(insights)`
- snapshots: list/save/restore/delete
- (optional) derived index stores

### 7.2 IndexedDB stores (recommended)
Canonical stores:
- meta, settings, rosters, insights
- logs (keyed by DateKey)
- snapshots
- outbox (queued remote ops)

Local-only derived stores:
- day_index
- week_index
- audit_log (ring buffer)
- sync_credentials (secrets; not exported)

### 7.3 Write strategy
Hot path:
- update in-memory state immediately
- persist to IDB:
  - immediate for day changes OR coalesced within a small window
- always flush on:
  - `visibilitychange` hidden
  - `pagehide`

---

<a id="sec-8-sync"></a>
## 8) Hosted sync architecture (same-origin)

### 8.1 High-level behavior
- If sync API is available, hosted sync is enabled by default.
- UI always uses local cache first.
- Offline edits enqueue outbox; outbox drains on reconnect.

### 8.2 Sync API constraints
- `/api/sync/*` must be network-only (never SW-cached).
- Responses must include `Cache-Control: no-store`.
- Use optimistic concurrency (ETag/If-Match).
- Prefer batch endpoints for performance.

### 8.3 Pull/merge/push algorithm
1) Boot: load local cache; render immediately
2) Pull remote index; fetch changed keys
3) Merge remote into local via HLC-first rules
4) Persist merged state locally
5) Drain outbox (batched), retry with backoff+jitter

### 8.4 Multi-tab correctness (leader election)
Use BroadcastChannel leader election:
- exactly one tab drains outbox and performs pulls
- other tabs broadcast local writes; leader picks up and flushes

Fallback lock: `localStorage` heartbeat with TTL.

### 8.5 Conflict handling
On 412 (ETag mismatch):
- fetch remote record
- merge
- snapshot “Sync conflict”
- retry PUT with fresh ETag

### 8.6 Optional E2EE
If enabled:
- AES-GCM encrypt record payloads client-side
- PBKDF2 passphrase derived key
- server stores ciphertext only
- passphrase never stored; only KDF params persisted

---

<a id="sec-9-backup"></a>
## 9) Import/export, snapshots, and recovery

### 9.1 Snapshots (automatic + manual)
Maintain snapshot ring buffer (default keep 7–14). Create snapshots on:
- pre-import
- pre-migration
- sync reset
- sync conflict
- manual “Create snapshot now”

### 9.2 Import flow (merge-safe)
1) validate payload
2) snapshot “Pre-import”
3) choose Merge/Replace (default Merge)
4) commit transaction
5) rebuild indexes as needed

### 9.3 Export formats
- JSON (sanitized; no secrets)
- encrypted JSON (AES-GCM)
- CSV (per-day rows)

### 9.4 Safe Mode recovery
If storage open fails, hydration fails validation, or migration fails:
- boot into Safe Mode:
  - diagnostics
  - snapshot restore
  - export recovery payload
  - disable hosted sync

---

<a id="sec-10-indexes"></a>
## 10) Derived indexes and review cache

### 10.1 DayIndex (local-only)
`day_index[DateKey]` stores:
- unique counts P/C/F/μ
- issue flags presence
- signals summary
- FTN mode summary
- lastEdited
- sourceRev/sourceHlc for staleness detection

### 10.2 WeekIndex (local-only)
`week_index[WeekKey]` stores:
- weekly unique counts
- matrix cell summaries
- issue frequency
- FTN mode counts
- optional cached correlations results

### 10.3 Incremental rebuild
- update day_index on day edits
- update week_index for affected week
- full rebuild on schema/indexVersion bump

> **Comment (tricky):** Derived indexes can go stale. Store `indexVersion` + `sourceRev/sourceHlc` per entry and rebuild automatically when mismatched.

---

<a id="sec-11-runtime"></a>
## 11) App runtime architecture (store, render, events)

### 11.1 Unidirectional store
- `dispatch(action)` → `reduce(state, action)` → schedule persistence + UI render
- reducers are pure; side-effects live in a small effect runner

### 11.2 Render scheduler + region patching
- one render per tick (`requestAnimationFrame`)
- screen split into regions (`data-region="topbar"`, `data-region="main"`, etc.)
- only dirty regions are replaced/patched

### 11.3 Event delegation
- single listener on `#app`
- route by `data-action` + payload in `data-*`

### 11.4 ViewModels (memoized selectors)
- UI reads view models, not raw state
- memoize per dateKey/weekKey and by state revision counters
- compute effective flags in one place (avoid duplicate logic)

### 11.5 Suggested module map
```
app/
  boot.js
  store.js
  reducer.js
  effects.js
ui/
  shell.js
  router.js
  events.js
  components/
  screens/
  vm/
  mockups/         # reference-only; not shipped
storage/
  adapter.js
  idb.js
  local.js
  sync_engine.js
  sync_leader.js
  remote_client.js
  snapshots.js
  indexes.js
  audit.js
domain/
  time_model.js
  heuristics.js
  review.js
  insights.js
sw.js
style.css
index.html
```

---

<a id="sec-12-sw"></a>
## 12) Service worker and caching

### 12.1 Precache (app-shell)
Precache:
- index.html
- style.css
- core JS modules
- fonts
- icons

### 12.2 Runtime caching
- minimal; avoid caching anything that can break correctness
- images only if needed (future)

### 12.3 API routes
Never cache `/api/*`, especially `/api/sync/*` (network-only).

### 12.4 Update UX
- detect new SW
- show update toast
- user taps → `skipWaiting` → reload

---

<a id="sec-13-privacy"></a>
## 13) Privacy and security

- Optional app lock: local-only passcode gate
- Privacy blur on background: hides content in task switcher
- Home redaction: hide roster labels/notes, show counts only
- Export encryption: AES-GCM with PBKDF2-derived key
- Hosted sync E2EE: ciphertext-only server option

---

<a id="sec-14-perf"></a>
## 14) Performance budgets

Targets (mid-range mobile):
- Today interactive < 1s after warm cache
- Segment sheet open < 150ms from tap
- chip toggle < 50ms UI response
- Review header immediate; full matrix within idle time

Key strategies:
- render scheduler + region patching
- memoized view models
- day/week indexes
- avoid expensive blur and large drop shadows on huge surfaces

---

<a id="sec-15-tests"></a>
## 15) Testing and acceptance checklist

### 15.1 Time model
- wrap-around day correctness
- activeDay after midnight correctness
- DST clamp deterministic
- solar arc clamp correctness

### 15.2 Logging
- chip toggles persist instantly
- segment counts correct
- tri-state flags correct
- segment status “none” clears selections
- undo reliably restores last action

### 15.3 History/Review
- history aggregates match logs
- matrix drill-down accurate
- rotation picks stable
- correlations show sample size and conservative language

### 15.4 Sync
- offline edits enqueue outbox and never block UI
- outbox drains on reconnect
- multi-tab leader prevents duplicate pushes
- conflict snapshot created on 412 merges

### 15.5 Backup/Recovery
- snapshot restore works
- safe mode triggers on forced storage failure
- exports do not contain secrets

### 15.6 UI mockup fidelity
- layout matches mockup “shape language”
- no CDN dependencies remain
- all spec-required info is present on relevant screens

---

<a id="sec-16-milestones"></a>
## 16) Implementation milestones

1) Visual system: local CSS tokens + components, fonts, icons
2) Shell + routing + delegated events
3) Today screen rebuild
4) Segment editor sheet rebuild
5) History + Day Detail + DayIndex
6) Review + WeekIndex + progressive compute
7) Settings + Rosters + Sync + Diagnostics + Snapshots UI
8) Multi-tab sync leader + audit log + conflict snapshots
9) Safe Mode + integrity checks
10) QA + regression hardening

---

<a id="sec-app-a-tags"></a>
## Appendix A: Tag conventions

Minimal tags that unlock high-value logic:

- Carbs:
  - `carb:starch` (rice, potato)
  - `carb:fruit` (fruit)
  - `carb:sugar` (honey)
- Fats:
  - `fat:dense` (tallow, butter, coconut oil)
  - `fat:seed_oil` (seed oils)
  - `fat:unknown` (restaurant / unknown oils)

---

<a id="sec-app-b-migrations"></a>
## Appendix B: Migration notes

### B.1 highFatDay boolean → Tri
On load/hydrate:
- if boolean present:
  - `true` → `"yes"`
  - `false` → `"no"` (or `"auto"` if you decide legacy false should mean “let auto decide”; default here is “no” to preserve user intent)

### B.2 Missing roster IDs referenced by logs
If a log references an ID not in rosters:
- keep the ID in the log (do not delete)
- show the item as `[Missing Item]` in UI
- add a diagnostics warning
- allow user to repair by recreating an item with same ID (advanced)

### B.3 Schema versioning
- Keep `meta.version=4` for continuity.
- If you later change canonical types materially, bump `meta.version` and write a migration + snapshot.

---

<a id="sec-app-c-mockmap"></a>
## Appendix C: Mockup-to-component mapping

**home.html**
- TopBar → TopBar component
- Solar arc hero → SolarHero component
- Segment deck cards → SegmentCard component (past/active/future variants)
- Bottom nav → BottomNav component

**segmenteditor.html**
- Bottom sheet container → Sheet component
- Category sections → CategoryGrid component
- Chip buttons → Chip component
- Footer search → CommandInput component
- Toggle row → TriControls component (replace booleans with tri-states)

**archive.html**
- Timeline list → HistoryList component
- Day card → DayCard component (expandable)
- Mechanical snap feel → CSS interaction states

**metrics.html**
- Matrix grid → ReviewMatrix component
- Rotation queue list → RotationQueue component
- Terminal panel → InsightsPanel component (replace copy with data-grounded insights)
