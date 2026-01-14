# Solar Log v4 — QA Test Plan

This plan translates the v4 spec QA checklist into concrete, repeatable manual tests.

## Test setup
- Run locally: `python3 -m http.server 5173`
- Open `http://localhost:5173/` and install as PWA if supported.
- Use a clean profile or clear storage before starting if you need a baseline.

## Automated e2e (optional)
- Run: `node scripts/run-e2e.mjs`
- Artifacts: `artifacts/e2e/` (logs, screenshots, traces, videos).

## 1) Time model (protocol day)
- **Non‑wrap day:** set Day Start 06:00, Day End 23:59. Confirm the active day matches today.
- **Wrap‑around day:** set Day Start 20:00, Day End 04:00. After midnight, confirm logs are attributed to the prior date.
- **Segment windows:** adjust FTN/Lunch/Dinner end times; verify the timeline segments update and remain ordered.
- **DST clamp:** set Day Start/End around a DST transition date; confirm no negative segment widths and diagnostics remain stable.

## 2) Core logging flow (≤10s)
- Open a segment, tap chips, set flags, add notes, close sheet.
- Verify bubble counts update on the timeline and flags show (×, ⚠, ◎).
- **Undo:** make a change and use Undo toast to revert.
- **Repeat last:** long‑press a timeline segment to copy the most recent logged segment.
- **Copy yesterday:** use the Copy yesterday button to copy all or select segments; verify overwrite confirmation.
- **Supplements (optional):** toggle items and notes; confirm they persist on reload.

## 3) Roster management
- Add a new roster item from the sheet (inline + add button) and confirm it appears immediately.
- Long‑press a chip to pin/unpin and confirm it moves to the pinned area and persists after reload.
- Archive an item in Settings and confirm it disappears from selection but remains in history.
- Search/typeahead: verify aliases and label search narrow the list.

## 4) Storage + diagnostics
- Reload the app and verify logs persist.
- Open Settings → Diagnostics:
  - Storage mode is `idb` when available, else `localStorage`.
  - Persistent storage status shows `granted/denied/unknown`.
  - Schema/App version and Install ID are populated.
- Create a manual snapshot; verify it appears in the list.
- Restore a snapshot and confirm the UI updates to that state.
- Delete a snapshot and confirm it disappears from the list/count.

## 5) Import/Export + snapshots
- Export JSON and ensure the file contains version/meta/rosters/logs.
- Export **encrypted JSON**, then import with the correct passphrase.
- Export **CSV** and confirm per‑day rows render in a spreadsheet.
- Import with Merge; verify data merges without overwriting unrelated entries.
- Import with Replace; verify prompt and the state fully updates.
- Confirm a pre‑import snapshot is created and visible in Diagnostics.

## 6) Review
- Open Review tab and verify:
  - Week range, unique counts, FTN summary, issue frequency, correlations.
  - Coverage matrix and rotation picks render.
- Click a matrix row/column and confirm it navigates to the correct day/segment.
- Insights panel shows placeholder when no insights exist.

## 7) Privacy
- Enable app lock, confirm lock screen appears after refresh and unlock works.
- Enable blur‑on‑background and verify it activates when tab is unfocused.
- Enable home redaction and confirm labels/notes are hidden on Today.

## 8) PWA + offline
- Load the app once, then go offline and reload; verify the shell loads.
- Update the service worker (bump cache version) and confirm update UX works.

## 9) Regression checklist
- No console errors during core flows.
- Data is not lost after refresh.
- No performance stalls when opening the sheet or switching tabs.
