# ShredMaxxer V4.0 Audit & Fix Report

## 🚨 Critical System Failures
The application is currently in a non-functional state. The core issue appears to be a silent failure during the [initializeState()](app.js#425-446) boot sequence or event wiring, which leaves the UI rendered but "dead".

### 1. 💀 Dead Navigation & Interaction
**Symptoms**:
- Sidebar tabs (LOGS, STATS, CFG) are unresponsive.
- "Edit" FAB (Floating Action Button) does nothing.
- Ritual buttons (Training, etc.) do not toggle.
- Date navigation (`<`, `>`) is broken.

**Root Cause Analysis**:
- **Event Listeners Missing**: The [wire()](ui/legacy.js#1313-1916) function in [ui/legacy.js](ui/legacy.js) attaches listeners. If [app.js](app.js) hangs during `await initializeState()`, `ui.init()` is never called, and [wire()](ui/legacy.js#1313-1916) never runs.
- **Router Conflict**: Both [ui/legacy.js](ui/legacy.js) and [ui/shell.js](ui/shell.js) attempt to handle routing. [shell.js](ui/shell.js) uses `hashchange` while [legacy.js](ui/legacy.js) uses manual class toggling. This redundancy can cause race conditions, though the "dead" state suggests [legacy.js](ui/legacy.js) listeners aren't active at all.

**Fix Plan**:
- [ ] **Wrap [initializeState](app.js#425-446)**: Add timeout and robust error handling to [app.js](app.js)'s boot sequence to force `ui.init()` to run even if storage fails.
- [ ] **Consolidate Routing**: Remove the nav listeners from [ui/legacy.js](ui/legacy.js) and rely solely on [ui/shell.js](ui/shell.js) + [router.js](ui/router.js) to drive view state via hash changes.
- [ ] **Verify [getElements](ui/elements.js#3-183)**: Ensure [app.js](app.js) is not accessing DOM elements before `DOMContentLoaded` (though module timing should prevent this, explicit check is safer).

### 2. ⏳ Time & Solar System Static
**Symptoms**:
- `CURRENT_TIME` stuck at `-- : --`.
- Solar arc path is empty/broken.
- Sun icon is misplaced (default 0,0).

**Root Cause Analysis**:
- **Missing Initial Render**: [renderSolarArc](ui/legacy.js#626-652) is only called inside [startTicks](ui/legacy.js#1917-1927) (via `setInterval` 20s delay) or [renderAll](ui/legacy.js#1309-1312). [renderToday](ui/legacy.js#822-844) does *not* call [renderSolarArc](ui/legacy.js#626-652).
- **Initialization Gap**: On first load, the solar system is never drawn until the first 20s tick (if it runs at all).

**Fix Plan**:
- [ ] **Call on Init**: Explicitly call [renderSolarArc(getActiveDateKey())](ui/legacy.js#626-652) inside `ui.init()` or [renderToday()](ui/legacy.js#822-844).
- [ ] **Fix Defaults**: Ensure [renderSolarArc](ui/legacy.js#626-652) handles cases where `sunrise`/`sunset` are missing gracefully.

### 3. 🛡️ Toast & Overlay Glitches
**Symptoms**:
- "Change saved" and "Update available" toasts appear on load.
- "Update" and "Undo" buttons inside toasts are dead.

**Root Cause Analysis**:
- **Premature Firing**: [boot.js](app/boot.js) immediately triggers [showUpdate](app/boot.js#15-24) if a SW is waiting.
- **Hidden Attribute Removal**: The logic likely removes the `hidden` attribute without validating the UI state or waiting for the app to be ready.
- **Dead Buttons**: Listeners for `undoAction` and `updateReload` are in [wire()](ui/legacy.js#1313-1916), which, as established, likely didn't run.

**Fix Plan**:
- [ ] **Defer Toast Logic**: Move SW update checks to happen *after* `ui.init()` completes.
- [ ] **Sanitize HTML**: Ensure `hidden` attributes are strictly enforced in [index.html](index.html) until JS explicitly reveals them.

### 4. 📐 Visual & Responsive Regressions
**Symptoms**:
- **Sidebar Overlap**: On mobile, the `bottom-nav` or header layout crushes content (left 20% obscured).
- **Misalignments**: Sun icon not centered, font sizes inconsistent ("v4.0"), pills uneven.
- **Empty Containers**: Energy/Mood/Cravings sections have no UI inputs (rendered empty).

**Root Cause Analysis**:
- **CSS Issues**: [style.css](style.css) has `position: sticky` for `bottom-nav` but might lack proper media queries for the sidebar behavior on mobile.
- **Missing Render Logic**: [renderScales](ui/legacy.js#775-788) (Energy/Mood) might be waiting for data that doesn't exist, and lacks a "default empty state" render.

**Fix Plan**:
- [ ] **Mobile CSS Audit**: Add `@media (max-width: 768px)` rules to ensure full-width layout and correct navbar positioning.
- [ ] **Scale Rendering**: Update [ui/components/scales.js](ui/components/scales.js) to render clickable notches/sliders even when value is empty.

### 5. ⚠️ Console & Network Errors
**Symptoms**:
- `favicon.ico` 404.
- "Password field is not contained in a form" warning.

**Fix Plan**:
- [ ] **Add Favicon**: Upload `favicon.ico` to assets.
- [ ] **Wrap Inputs**: Wrap the App Lock password input in a `<form>` tag to satisfy browser accessibility/password manager heuristics.

## Proposed Implementation Steps
1.  **Refactor [app.js](app.js) Boot**: Wrap [initializeState](app.js#425-446) in a timeout race to guarantee UI boot.
2.  **Fix [renderSolarArc](ui/legacy.js#626-652)**: Add immediate call in [renderToday](ui/legacy.js#822-844).
3.  **Debug [wire()](ui/legacy.js#1313-1916)**: Add console logs to verify event attachment.
4.  **Consolidate Router**: Remove duplicate nav logic from [legacy.js](ui/legacy.js).
5.  **CSS Polish**: Fix specific misalignments and mobile overlap.

