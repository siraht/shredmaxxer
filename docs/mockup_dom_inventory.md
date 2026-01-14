# Mockup DOM Inventory + Element Mapping

Purpose: map existing UI element IDs (from `ui/elements.js`) to the four mockup layouts so we can replace the live DOM with the mockups without losing functionality.

Mockup sources (4 screens):
- Home/Today: `ui/mockups/home.html`
- Segment Editor (sheet): `ui/mockups/segmenteditor.html`
- Archive/History: `ui/mockups/archive.html`
- Metrics/Review: `ui/mockups/metrics.html`

Notes:
- The mockups are design references and do not contain our required `id` hooks. We must add explicit IDs/classes to the mockup markup when transplanting into `index.html`.
- The live app still needs Settings + global overlays. Those are not in the mockups, so we will keep the settings panel and overlays as separate routed sections layered into the new shell.
- For any element below marked "add", create the element in the mockup DOM at the specified position with the indicated ID.

---

## Global Shell + Routing

Required element IDs:
- `tabToday`, `tabHistory`, `tabReview`, `tabSettings`: map to bottom nav buttons in the Home mockup. Add IDs to the button elements.
- `outboxBadge`: add badge to the Review/History/Settings nav icon (small counter).
- `viewToday`, `viewHistory`, `viewReview`, `viewSettings`: each routed section wrapper. Wrap each screen in a `<section>` with the appropriate ID.
- `syncStatus`: global sync status label in top bar (Home mockup header right cluster). Add a span ID.

Overlays (global, not tied to a mockup):
- `undoToast`, `undoLabel`, `undoAction`
- `appLockOverlay`, `appLockInput`, `appLockSubmit`, `appLockMessage`
- `privacyBlurOverlay`
- `redactionBanner`

Place these in the global shell (outside the 4 screen sections), visually hidden until needed.

---

## Home / Today (ui/mockups/home.html)

Header/top bar:
- `syncStatus`: right-side status chip ("SYNCED"/NET/BAT) in header.

Day controls (add to the hero/time block):
- `prevDay`, `nextDay`: add small buttons near the time display.
- `datePicker`: add hidden/inline input (type=date) near the time display.
- `currentTime`: digital current time readout (HH:MM) in hero.
- `copyYesterday`: add button near the segment deck header.
- `phaseLabel`, `phaseSub`: add small labels near hero to show phase and subtext.
- `toggleFocus`, `focusLabel`: add toggle affordance + label near timeline/hero.
- `fabEdit`: floating edit button (opens current segment).

Timeline / segments:
- `timelineTrack`: the segment deck container (replace static cards with dynamic list). Add a container div with this ID.
- `nowMarker`: absolute marker in the segment deck/timeline (add a child inside the deck container).
- `futureFog`: overlay in the timeline area (add a child div inside the deck container).

Solar arc (add inside hero section):
- Add an inline SVG and map:
  - `sunArc` (path)
  - `sunDot` (circle)
  - `sunGlow` (circle)
  - `sunTime` (text)

Rituals panel (add row/cards under deck):
- `movedBeforeLunch`, `trained`, `highFatDay`: buttons/toggles.
- `moveSub`, `trainSub`, `fatDaySub`: sublabels inside each ritual card.

Signals / scales (add a three-column section):
- `energyScale`, `moodScale`, `cravingsScale`: container elements for scale builders.

Nudge card:
- `todayNudge`, `todayNudgeTitle`, `todayNudgeMessage`, `todayNudgeReason`, `todayNudgeDismiss`.

Notes:
- `notesBlock`: container section.
- `notes`: textarea.

Supplements:
- `supplementsPanel`, `supplementsModeLabel`, `supplementsChips`, `supplementsNotes`.

---

## Segment Editor (ui/mockups/segmenteditor.html)

Sheet container:
- `sheet`: the bottom sheet root (currently the main sheet div in mockup).
- `sheetBackdrop`: add a backdrop layer behind sheet.
- `closeSheet`: add X/close button in the sheet header.
- `doneSegment`: map to LOG button.
- `clearSegment`: add secondary clear/reset action near LOG.

Header:
- `sheetTitle`: segment title ("LUNCH").
- `sheetSub`: subtitle/time range.
- `sheetWindowLabel`, `sheetWindowTime`: right-side window label + range callout.
- `sheetProgress`: progress bar element under header (decorative, updated per segment).
- `ftnModeRow`: add row hidden unless segment is FTN.
- `ftnModeSeg`: segmented control for FTN mode.

Roster search + chips:
- `searchProteins`, `searchCarbs`, `searchFats`, `searchMicros`: input fields (can be in a hidden drawer or inline under each section).
- `chipsProteins`, `chipsCarbs`, `chipsFats`, `chipsMicros`: grid containers in each nutrient section.
- `addProtein`, `addCarb`, `addFat`, `addMicro`: add “ADD” buttons per nutrient section.

Flags + notes:
- `segCollision`, `segHighFat`, `segSeedOil`, `segStatus`: segmented control containers (replace the simple toggles in mockup footer).
- `segNotes`: textarea near footer.
- `flagHelp`: helper text block in footer.

---

## Archive / History (ui/mockups/archive.html)

Main list:
- `historyList`: container inside the scrollable timeline column (replace sample cards with dynamic list items).

Export/import cluster (add a utility panel in header or footer):
- `exportBtn`, `exportAltBtn`, `exportCsvBtn`
- `importMode` (segmented buttons), `importFile` (file input), `importApply`, `importStatus`

Diagnostics + audit + snapshots:
- `diagStorageMode`, `diagPersistStatus`, `diagSafeMode`, `diagDstClamp`, `diagSchemaVersion`, `diagAppVersion`, `diagInstallId`, `diagSnapshotCount`, `diagMissingItems`
- `auditFilter`, `auditLogList`
- `snapshotCreate`, `snapshotList`

(These can live in a collapsible “Diagnostics” drawer at the end of the archive scroll.)

---

## Metrics / Review (ui/mockups/metrics.html)

Coverage + summary:
- `coverageMatrix`: replace the mockup’s static grid with the rendered matrix.
- `reviewRange`: heading sublabel (date span).
- `reviewSummary`: summary line under the range.
- `reviewPhase`: phase label near summary.

Issues + correlations + insights:
- `reviewIssues`: container for issue list.
- `reviewCorrelations`: container for correlations table.
- `reviewInsights`: container for insights blocks.

Rotation:
- `rotationPicks`: container for rotation queue list.

---

## Settings (not in mockups)

Settings remains as its own routed section:
- `setDayStart`, `setDayEnd`, `setFtnEnd`, `setLunchEnd`, `setDinnerEnd`
- `setSunrise`, `setSunset`, `setSunMode`, `sunAutoBtn`, `sunAutoStatus`
- `setPhase`, `setFocusMode`, `setWeekStart`, `setSupplementsMode`
- `saveSettings`, `resetToday`
- `syncLinkInput`, `syncLinkApply`, `syncLinkCopy`, `syncLinkStatus`, `syncNowBtn`, `syncResetSpace`, `syncE2eeToggle`
- `privacyAppLockToggle`, `appLockSetBtn`, `privacyBlurToggle`, `privacyRedactToggle`, `privacyEncryptedToggle`, `todayNudgeToggle`
- `roster-proteins`, `roster-carbs`, `roster-fats`, `roster-micros`, `roster-supplements`, `roster-supplements-block`

Recommendation: keep the existing Settings layout for now but re-skin with mockup tokens once screens are wired.
