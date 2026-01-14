# AGENTS.md — Solar Log v4 (Local‑First PWA)

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

This repo is **Solar Log v4**, a local‑first PWA for segmented‑day protocol adherence and food‑variety tracking.

**Canonical spec:**
- `Solar Log v4 Implementation.md`

When implementing or editing anything, align to that spec and treat its invariants as hard requirements.

---

## Core Invariants (Do Not Break)

These are first‑class system rules and must be enforced in any code, docs, or workflows you add:

- **Local‑first, no backend:** data stays on‑device unless the user explicitly exports it.
- **No build chain:** Vanilla HTML/CSS/JS with ES Modules; no bundler or framework.
- **Speed rule:** primary logging flow must be doable in ≤10 seconds.
- **Protocol day time model:** wrap‑around dayStart/dayEnd with correct activeDay resolution after midnight.
- **Durable storage:** IndexedDB‑first with fallback; snapshots before import/migration.
- **Stable identity:** roster items are ID‑based with tags, aliases, pinned, archived.
- **Explainable logic:** computed flags and insights must be traceable to tags/selections.
- **Non‑goals stay non‑goals:** no calorie/macro tracking, no body metrics, no heavy nutrition detail.

---

## MVP Non‑Negotiables (v4 P0)

Do not remove or weaken these requirements on the MVP path:

- Protocol day time model (wrap‑around + activeDay + DST clamp)
- IndexedDB‑first persistence with fallback
- Roster ID migration (strings → items) with tags and stable IDs
- Import merge + snapshots (pre‑import / pre‑migration)
- Weekly Review 2.0 (coverage matrix + rotation picks)

---

## Product Goals (Context for Future You)

- **Primary:** make logging feel like “tapping a ritual” rather than “doing admin.”
- **Secondary:** support variety, reduce HFHC collisions, track seed oils, and improve adherence without friction.
- **Privacy posture:** local‑only by default; optional hardening (app lock, privacy blur, encrypted export).
- **Delight:** recents, pinned items, undo/repeat, and a solar‑arc timeline that reflects the protocol day.

---

## Tech Stack (Project‑Specific Defaults)

- **Runtime:** Vanilla browser JS (no Node build step)
- **UI:** HTML/CSS, ES Modules, `// @ts-check` + JSDoc
- **Storage:** IndexedDB primary, localStorage fallback
- **PWA:** Service worker app‑shell cache + manifest
- **Crypto:** WebCrypto AES‑GCM for encrypted export (optional)

If a different stack is chosen, document the swap explicitly and keep invariants unchanged.

---

## Repo Layout (Spec‑Aligned)

Current repo includes a v3 prototype plus v4 scaffolding. Align new code to these folders:

```
/shredmaxxer
├── AGENTS.md
├── Solar Log v4 Implementation.md   # Canonical spec
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

## Tooling Notes (Local‑First PWA)

- Use `python3 -m http.server` for local serving when needed.
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
