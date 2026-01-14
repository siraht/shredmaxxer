# Fixture datasets

These files are small, deterministic datasets for validating migration and merge behavior.

## v3-sample.json
**Purpose:** validate v3 → v4 migration, wrap‑around day settings, and missing roster items.

**Key cases:**
- `settings.dayStart=20:00` and `dayEnd=04:00` (wrap‑around day).
- Lunch includes `Salmon`, which is **not** present in v3 rosters.

**Expected outcomes:**
- Migration creates v4 roster items for `Salmon` (from logs).
- Wrap‑around settings preserved.
- Segment flags/notes and day signals preserved.

## v4-base.json
**Purpose:** baseline v4 export for merge tests.

**Key cases:**
- Stable roster IDs and tags.
- One day of logs with rev values.

## v4-conflict.json
**Purpose:** conflicting v4 export with higher rev/tsLast values.

**Key cases:**
- Lunch segment has **higher rev** and later `tsLast` than v4-base.
- Adds a new carb item (`carb-potato`) to test roster merging.

**Expected merge outcomes (merge import):**
- For `2026-01-11`, lunch segment should resolve to the **higher rev** record (from v4-conflict).
- Roster merge should include `carb-potato` alongside existing items.
