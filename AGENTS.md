# AGENTS.md — Solar Log v4 (Hosted‑Sync‑First PWA)

## RULE 1 – ABSOLUTE (DO NOT EVER VIOLATE THIS)

You may NOT delete any file or directory unless I explicitly give the exact command **in this session**.

- This includes files you just created (tests, tmp files, scripts, etc.).
- You do not get to decide that something is "safe" to remove.
- If you think something should be removed, stop and ask. You must receive clear written approval **before** any deletion command is even proposed.

Treat "never delete files without permission" as a hard invariant.

---

## IRREVERSIBLE GIT & FILESYSTEM ACTIONS

Absolutely forbidden unless I give the **exact command and explicit approval** in the same message:

- `git reset --hard`
- `git clean -fd`
- `rm -rf`
- Any command that can delete or overwrite code/data

Rules:

1. If you are not 100% sure what a command will delete, do not propose or run it. Ask first.
2. Prefer safe tools: `git status`, `git diff`, copying to backups, etc.
3. After approval, restate the command verbatim, list what it will affect, and wait for confirmation.
4. When a destructive command is run, record in your response:
   - The exact user text authorizing it
   - The command run
   - When you ran it

If that audit trail is missing, then you must act as if the operation never happened.

---

## Project Definition (Source of Truth)

This repo is **Solar Log v4**, a hosted‑sync‑first PWA with an offline‑first cache for segmented‑day protocol adherence and food‑variety tracking.

**Canonical spec:**
- `docs/spec_vNext.md`

When implementing or editing anything, align to that spec and treat its invariants as hard requirements.

---

## Core Invariants (Do Not Break)

These are first‑class system rules and must be enforced in any code, docs, or workflows you add:

- **Hosted‑sync‑first (same‑origin):** durable replication uses `/api/sync/v1/*` by default; the UI always reads/writes the local cache first so logging stays instant and fully offline.
- **No build chain:** Vanilla HTML/CSS/JS with ES Modules; no bundler or framework.
- **Speed rule:** primary logging flow must be doable in ≤10 seconds.
- **Protocol day time model:** wrap‑around dayStart/dayEnd with correct activeDay resolution after midnight.
- **Durable replication:** hosted sync + IndexedDB cache + persistent outbox; snapshots before import/migration/sync‑reset.
- **Stable identity:** roster items are ID‑based with tags, aliases, pinned, archived.
- **Explainable logic:** computed flags and insights must be traceable to tags/selections.
- **Non‑goals stay non‑goals:** no calorie/macro tracking, no body metrics, no heavy nutrition detail.
- **Export hygiene:** plain JSON exports must exclude sync credentials/passphrases.

### Hosted Sync Requirements (Spec‑Aligned)

These are mandatory behaviors for hosted sync:

- **Offline‑first cache:** writes commit to IndexedDB first; UI never blocks on network.
- **Outbox replication:** queued writes drain in background with exponential backoff + jitter; failures never block logging.
- **Sync API contract:** same‑origin `/api/sync/v1/*` with `Cache-Control: no-store`, `ETag/If-Match` concurrency, and `Idempotency-Key` on writes.
- **Merge ordering:** prefer higher `hlc`; fall back to `(rev, tsLast)`; final tie‑break by `actor` lexicographic.
- **Single‑tab leadership:** use `BroadcastChannel` to avoid multi‑tab sync races.
- **Optional E2EE:** if enabled, hosted sync stores ciphertext only (AES‑GCM + PBKDF2); bind ciphertext to `{spaceId, key}` as AEAD AAD.

---

## MVP Non‑Negotiables (v4 P0)

Do not remove or weaken these requirements on the MVP path:

- Protocol day time model (wrap‑around + activeDay + DST clamp)
- Hosted sync by default (same‑origin) with IndexedDB offline cache + localStorage fallback
- Outbox replication (never blocks logging) + merge‑safe pull/merge/push
- HLC/actor merge ordering with legacy fallback (`rev`, `tsLast`)
- Roster ID migration (strings → items) with tags and stable IDs
- Import merge + snapshots (pre‑import / pre‑migration / pre‑sync)
- Weekly Review 2.0 (coverage matrix + rotation picks)

---

## Hosted Sync Spec Coverage (Must Stay Aligned)

Ensure these spec elements are reflected in code + docs:

- **Sync UI (Settings):** status (Idle/Syncing/Offline/Error), Sync now, Copy/Paste Sync Link, Reset sync space, optional E2EE toggle, advanced pause + endpoint override.
- **Diagnostics:** show sync status in addition to storage mode + persist status.
- **Sync link:** includes `spaceId` + `authToken` (and optional E2EE hint); credentials stored locally only.
- **Data model additions:** `hlc` + `actor` on segment/day; `Settings.sync` (mode/endpoint/spaceId/encryption/pushDebounceMs/pullOnBoot); `Meta.sync` status fields; `InsightsState` (dismissals); Snapshot label includes **Pre-sync**.
- **Storage adapter:** add `saveInsights` and `deleteSnapshot`.
- **IndexedDB stores:** add `sync_credentials` (not exported), `insights`, and `outbox` stores alongside meta/settings/rosters/logs/snapshots.
- **Import/merge:** order by `hlc` first, fallback to `(rev, tsLast)` for legacy.
- **Exports:** plain JSON excludes sync credentials and any E2EE passphrase.
- **Sync API:** `/api/sync/v1/index`, `/item/:key`, `/batch`, optional `/create`; `Cache-Control: no-store`, `ETag/If-Match`, `Idempotency-Key`.

---

## Product Goals (Context for Future You)

- **Primary:** make logging feel like “tapping a ritual” rather than “doing admin.”
- **Secondary:** support variety, reduce HFHC collisions, track seed oils, and improve adherence without friction.
- **Privacy posture:** hosted sync by default with an offline cache; optional hardening (app lock, privacy blur, encrypted export, optional E2EE for sync).
- **Delight:** recents, pinned items, undo/repeat, and a solar‑arc timeline that reflects the protocol day.

---

## Tech Stack (Project‑Specific Defaults)

- **Runtime:** Vanilla browser JS (no Node build step)
- **UI:** HTML/CSS, ES Modules, `// @ts-check` + JSDoc
- **Storage:** Hosted sync (same‑origin) + IndexedDB offline cache + localStorage fallback
- **PWA:** Service worker app‑shell cache + manifest
- **Crypto:** WebCrypto AES‑GCM for encrypted export; optional E2EE for hosted sync

If a different stack is chosen, document the swap explicitly and keep invariants unchanged.

---

## Repo Layout (Spec‑Aligned)

Current repo includes a v3 prototype plus v4 scaffolding. Align new code to these folders:

```
/shredmaxxer
├── AGENTS.md
├── docs/spec_vNext.md               # Canonical spec
├── spec_v5.md                       # Superseded spec (historical)
├── index.html                        # Prototype UI shell (v3)
├── app.js                            # Prototype logic (v3)
├── style.css                         # Prototype styling
├── sw.js                             # PWA service worker (v3)
├── manifest.webmanifest
├── icons/
├── domain/                           # Time model, aggregators, heuristics, insights
├── storage/                          # IndexedDB adapter, import/export, migration
├── ui/                               # Rendering + event bindings
├── app/                              # Boot, routing, tiny store
└── assets/fonts/                     # WOFF2 fonts (v4 plan)
```

If the repo layout deviates, update this section and document why.

---

## Generated Files — NEVER Edit Manually

**Current state:** No generated artifacts are checked in.

If/when generated outputs are added:

- Put them in a clearly labeled directory (e.g., `generated/`).
- Document the generator command adjacent to the output.
- Never hand‑edit generated files.

---

## Code Editing Discipline

- Do **not** run scripts that bulk‑modify code (codemods, invented one‑off scripts, giant `sed`/regex refactors).
- Large mechanical changes: break into smaller, explicit edits and review diffs.
- Subtle/complex changes: edit by hand, file‑by‑file, with careful reasoning.

---

## Backwards Compatibility & File Sprawl

We optimize for clarity and maintainability over long‑term backward compatibility.

- Avoid shims and duplicated “v2/v3” copies.
- When behavior changes, migrate callers and remove old code.
- New files only for new domains that don’t fit existing modules.

---

## Console Output

- Prefer structured, minimal logs (avoid spammy debug output).
- User‑facing UX is UI‑first; logs are for diagnostics only.

---

## Tooling Notes (Hosted‑Sync PWA)

- Use `python3 -m http.server` for local serving when needed (sync API will be unavailable; app should fall back to local‑only mode).
- No package manager is required unless adding tools; if that changes, document it here.
- Testing tooling decision: Playwright is preferred for e2e and browser-only unit tests (npm dev-only).
- Prefer `rg` for search.

---

## Issue Tracking with bd (If .beads/ Exists)

If this repo uses Beads (`.beads/` present), all issue tracking goes through **bd**.

Basics:

```bash
bd ready --json
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd update bd-42 --status in_progress --json
bd close bd-42 --reason "Completed" --json
```

Rules:
- `.beads/` is authoritative and must be committed with code changes.
- Do not edit `.beads/*.jsonl` directly; only via `bd`.

If `.beads/` is not present, ask before introducing it.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
