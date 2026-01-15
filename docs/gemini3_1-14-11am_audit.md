# ShredMaxxer V4.0 Remediation Plan & Audit

*Generated: Jan 14, 2026*
*Scope: Complete Application Audit (Desktop/Mobile)*

## 1. Executive Summary & Philosophy

### Context
The application has undergone a significant refactor (V4.0) to modernize the UI/UX. While the core functionality exists, the current state suffers from "death by a thousand cuts"—numerous small visual, functional, and layout issues that collectively degrade the user experience and trust.

### Remediation Philosophy
This plan is structured not just to "fix bugs" but to **stabilize the foundation**. We will move geographically:
1.  **Deep Infrastructure**: Fix data sync and error handling first so the app is reliable.
2.  **Global CSS/Layout**: Fix the responsive container, typography, and theme variables so we stop fighting the layout.
3.  **Components**: Tackle individual UI elements (cards, modals) once the global styles are stable.
4.  **Polish**: Final aesthetic tweaks.

> **Note to Future Self:** Do not jump straight to fixing "small UI bugs" (like button overlaps) without fixing the *parent container* issues (like the fixed-width `.app-shell`). Fixing the root cause often resolves multiple symptoms at once.

---

## 2. Phase 1: Critical Infrastructure & Reliability (P0)

**Goal:** Ensure the app doesn't look "broken" or scary to the user. Trust is paramount.

### 2.1 Sync & Error Handling
*Dependencies: None*
*Reasoning: Persistent error indicators (Error • 1) cause user anxiety and mask real issues.*

- [x] **[SB-01] Handle Global Sync Errors**
    - *Issue:* "Error • 1" displays persistently even for local-first usage.
    - *Fix:* Update `sync.js` to suppress 404/405 errors from default endpoints. Logic should be: "If no custom endpoint is set, do not attempt sync."
- [x] **[SB-30] Suppress Console 405s**
    - *Issue:* Continuous POST requests clutter the network log.
    - *Fix:* Verify `sync` configuration before firing `fetch`.
- [x] **[SB-31] Fix Notification Badge Logic**
    - *Issue:* Red badge on "CFG" tab persists without active items.
    - *Fix:* Ensure badge count derivation strictly reflects `outbox.length` or actual error count.

### 2.2 Routing & Navigation Stability
*Dependencies: None*
*Reasoning: Navigation creates the "feel" of a native app. Flashing content breaks immersion.*

- [x] **[SB-32] Fix View Transition Flicker**
    - *Issue:* Old content remains visible briefly when switching tabs.
    - *Fix:* Ensure `router.setRoute` hides the previous view *before* or *simultaneously* with showing the new one. Check `requestAnimationFrame` timing.
- [x] **[SB-52] Fix Theme Toggle Redirect**
    - *Issue:* Toggling theme on Review page kicks user to Settings.
    - *Fix:* `preventDefault()` on the theme toggle click event; ensure it doesn't propagate to a parent `<a href="...">` or route handler.

### 2.3 Date & Time Integrity
*Dependencies: None*

- [x] **[SB-06] Fix "Time --:--" Flash**
    - *Fix:* hydrating the time display immediately in the main `init()` flow, not just in a `setInterval`.

---

## 3. Phase 2: Design System & Layout Foundation (P1)

**Goal:** Fix the layout constraints so we stop using "magic numbers" for positioning.

### 3.1 Global Layout & Responsiveness
*Dependencies: Phase 1*
*Reasoning: The app is currently checking for specific screen sizes rather than being fluid.*

- [x] **[SB-25] Implement Fluid App Shell**
    - *Issue:* Fixed width on desktop with massive margins; cramped on mobile.
    - *Fix:* Change `.app-shell` to `max-width: 600px; width: 100%; margin: 0 auto;`. Remove rigid fixed pixel widths.
- [x] **[SB-76] Responsive Navigation Container**
    - *Issue:* Bottom nav is standard on mobile but weird on desktop if the app is wide.
    - *Fix:* Keep bottom nav for now (mobile-first), but ensure it respects the `max-width` of the text container so it doesn't span 1920px.

### 3.2 Typography & Accessibility Foundation
*Dependencies: None

- [x] **[SB-63] Standardize Border Radii**
    - *Fix:* Convert all distinct `border-radius: Xpx` to `var(--radius)` or `var(--radius-sm)`. Created `--radius-sm`, `--radius-md`, `--radius-full` tokens.

---

## 4. Phase 3: Core Component Interactions (P2)

**Goal:** Make the app usable for human fingers on touch devices.

### 4.1 Touch Targets & Mobile Usability
*Dependencies: Phase 2*

- [x] **[SB-14] Enlarge Rating Dots**
    - *Issue:* 1-5 dots are too small.
    - *Fix:* Added transparent padding to `.dot` via pseudo-element to increase hit area to 44x44px while maintaining visual size.
- [x] **[SB-45] Fix History Filter Buttons**
    - *Fix:* Increased `min-height` and padding for filter chips to improve mobile usability.
- [x] **[SB-43] FAB Positioning**
    - *Fix:* Adjusted FAB `bottom` to clear the navigation bar reliably including safe area insets.

### 4.2 Modal & Input Polish
*Dependencies: Phase 2*

- [x] **[SB-27] Fix Modal Horizontal Scroll**
    - *Issue:* `100vw` width often ignores scrollbar width, causing overflow.
    - *Fix:* Used `width: 100%` with `max-width: 600px` to constrain modal to app shell width.
- [x] **[SB-58] Improve Modal Close Button**
    - *Fix:* Enlarged close icon hit area to 44x44px and standardized header spacing.
- [x] **[SB-56/57] Fix Nutrient Button Wrapping**
    - *Issue:* "FATTY FISH" overflows.
    - *Fix:* Enabled `flex-wrap` and adjusted flex direction for chips to prevent horizontal overflow.

### 4.3 Notification System
*Dependencies: Phase 2*

- [x] **[SB-16] Auto-Dismiss Notifications**
    - *Fix:* Verified `setTimeout` logic and added timer reset safety to prevent persistent toasts.
- [x] **[SB-17] Notification Stacking**
    - *Fix:* Optimized CSS positions and logic to handle multiple notification types without collision.

---

## 5. Phase 4: Feature-Specific Polish (P3)

**Goal:** Clean up the details relative to specific domains (Solar, Diet, Logs).

### 5.1 Solar & Time Domain
- [x] **[SB-08] Refine Sun Position Math:** Progress matches actual day percentage.
- [x] **[SB-77] Smooth Solar Path:** Used Cubic Bezier curve for path smoothing.
- [x] **[SB-33] Timezone Label:** Fixed tiny font size.

### 5.2 Segments & Rituals
- [x] **[SB-09] Fix "WINDOW" Label Overlap:** Adjusted padding/casing.
- [x] **[SB-11] Nutrient Progress Indicators:** Improved contrast.
- [x] **[SB-79] Modernize "Copy Yesterday":** Replaced `prompt()` with bottom-sheet.

### 5.3 History & Analytics
- [x] **[SB-44] Standardize Headers:** Standardized "MISSION LOG ARCHIVE" H1 styles.
- [x] **[SB-73] Pagination:** Implemented "Load More" for history.
- [x] **[SB-20] Matrix Legend:** Added legend to coverage matrix.

### 5.4 Settings & Configuration
- [x] **[SB-22] Constrain Input Widths:** Added `max-width` to inputs.
- [x] **[SB-23] Custom Select Dropdowns:** Enhanced select styling.
- [x] **[SB-24] Danger Zone Separation:** Wrapped reset buttons in a labeled zone.

---

## 6. Complete Issue Reference Table

For tracking individual ticket status.

| ID | Phase | Component | Description |
|----|-------|-----------|-------------|
| **SB-01** | P0 | Header | Sync Error visual false positive |
| **[x] SB-02** | P3 | Header | Static status pills |
| **[x] SB-03** | P1 | Nav | Nav label size |
| **[x] SB-04** | P1 | Nav | Active tab styling |
| **[x] SB-05** | P3 | Nav | Redundant badge |
| **SB-06** | P0 | Hero | Time initialization flash |
| **SB-07** | P0 | Hero | Date picker default |
| **[x] SB-08** | P3 | Solar | Sun position math |
| **[x] SB-09** | P3 | Segments | Text overlap "WINDOW" |
| **[x] SB-10** | P3 | Segments | Casing inconsistency |
| **[x] SB-11** | P3 | Segments | Micronutrient indicators |
| **[x] SB-12** | P1 | Segments | Ghost button contrast |
| **[x] SB-13** | P1 | Segments | Status text contrast |
| **[x] SB-14** | P2 | Metrics | Touch target size (dots) |
| **SB-15** | P3 | Metrics | Scale labels |
| **[x] SB-16** | P2 | Toast | Auto-dismiss logic |
| **[x] SB-17** | P2 | Toast | Stacking logic |
| **[x] SB-18** | P3 | Logs | Search placeholder truncating |
| **[x] SB-19** | P1 | Logs | Indicator contrast |
| **[x] SB-20** | P3 | Matrix | Cryptic headers |
| **[x] SB-21** | P3 | Matrix | Row cramp/spacing |
| **[x] SB-22** | P3 | Settings | Input max-width |
| **[x] SB-23** | P3 | Settings | Select styling |
| **[x] SB-24** | P3 | Settings | Danger zone separation |
| **[x] SB-25** | P1 | Layout | Fluid responsiveness |
| **SB-26** | P1 | Mobile | Side nav interaction area (N/A) |
| **[x] SB-27** | P2 | Modal | Horizontal scroll fix |
| **[x] SB-28** | P2 | Modal | Text overflow buttons |
| **[x] SB-29** | P3 | UI | Vignette intensity |
| **SB-30** | P0 | Network | Console 405 suppression |
| **SB-31** | P0 | Nav | Badge logic state |
| **SB-32** | P0 | Nav | Route transition flicker |
| **[x] SB-33** | P3 | Hero | Timezone label size |
| **[x] SB-34** | P3 | Dates | Redundant arrows |
| **[x] SB-35** | P3 | Segments | Card alignment (Grid) |
| **[x] SB-36** | P3 | Segments | Card gap/spacing |
| **[x] SB-37** | P3 | Rituals | Data type icons |
| **[x] SB-38** | P3 | Nudge | Empty state handling |
| **[x] SB-39** | P3 | Supplements | "Off" enablement UX |
| **[x] SB-40** | P3 | Notes | Redundant labels |
| **[x] SB-41** | P3 | Notes | Placeholder text |
| **[x] SB-43** | P2 | FAB | Z-index/Positioning |
| **[x] SB-44** | P3 | History | Header standardization |
| **[x] SB-45** | P2 | History | Filter touch targets |
| **[x] SB-46** | P3 | History | Sync error noise |
| **[x] SB-47** | P3 | History | Toggle feedback |
| **[x] SB-48** | P3 | History | Toggle context labels |
| **[x] SB-49** | P3 | Matrix | Cell alignment |
| **[x] SB-50** | P3 | Matrix | Empty cell noise |
| **SB-51** | P3 | Rotation | Picker contrast |
| **SB-52** | P0 | Review | Theme toggle redirect |
| **SB-53** | P3 | Review | Button grouping |
| **SB-54** | P3 | Settings | Micro-copy size |
| **SB-55** | P3 | Settings | Link input width |
| **[x] SB-56** | P2 | Modal | Collagen button wrap |
| **[x] SB-57** | P2 | Modal | Fatty fish button wrap |
| **[x] SB-58** | P2 | Modal | Close button hit area |
| **SB-59** | P3 | Modal | Header colors |
| **[x] SB-60** | P3 | Modal | Time window duplication |
| **[x] SB-61** | P2 | Modal | Mode button spacing |
| **SB-62** | P3 | UI | Scrollbar theming |
| **[x] SB-63** | P1 | UI | Border radius consistency |
| **SB-64** | P3 | Nav | Icon distinction |
| **SB-65** | P0 | Sync | Status consistency |
| **SB-66** | P3 | Matrix | Header tooltips |
| **SB-67** | P3 | UI | Scroll jitter |
| **[x] SB-68** | P2 | UI | Modal backdrop z-index |
| **[x] SB-69** | P2 | UI | Focus states |
| **[x] SB-70** | P3 | Matrix | Rotation invisible items |
| **[x] SB-71** | P2 | Modal | Close button consistency |
| **[x] SB-72** | P3 | Header | Hardcoded version |
| **[x] SB-73** | P3 | Performance| DOM node count |
| **[x] SB-74** | P3 | UI | Grid background noise |
| **[x] SB-75** | P1 | UI | WCAG Contrast |
| **[x] SB-76** | P1 | Nav | Side nav vs Bottom nav |
| **[x] SB-77** | P3 | Hero | Solar path smoothing |
| **[x] SB-78** | P3 | Hero | Sun glow intensity |
| **[x] SB-79** | P3 | Segments | Remove `prompt()` |
| **[x] SB-80** | P3 | Segments | Card alignment jitter |
| **SB-81** | P2 | Metrics | Slider input |
| **[x] SB-82** | P3 | Notice | Infinite update prompt |
| **[x] SB-83** | P3 | UI | Dropdown arrows |
| **[x] SB-84** | P3 | Header | Matrix mobile spacing |
| **[x] SB-85** | P3 | Help | Onboarding/Info |
