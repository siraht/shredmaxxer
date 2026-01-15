# ShredMaxxer V4.0 Supplemental Audit
*Generated: Jan 14, 2026 5:30 PM*
*Scope: Visual, Functional, and Codebase Deep Dive*

## 1. Executive Summary
Following the remediation of P0 (Critical Infrastructure) and P1 (Layout Foundation), the application is stable but lacks the premium "feel" of a native app. This audit identifies 75+ specific items across **Visual Polish**, **Micro-Interactions**, **Mobile Usability**, and **Code Maintainability** that need to be addressed to reach production quality.

## 2. Visual Polish & Alignment (P3)

### 2.1 Spacing & Grid integrity
1.  [ ] **[VP-01] Roster Item Padding:** `.roster-item` padding (10px) is visually tighter than the global `14px` standard, causing a cramped feel.
2.  [ ] **[VP-02] Matrix Header Misalignment:** The `.matrix-head` row labels are not perfectly vertically aligned with the `.matrix-cell` rows below them due to different line-heights.
3.  [ ] **[VP-03] Modal Bottom Sheet Handle:** The `.sheet-handle` top margin (4px) is too small, pushing it too close to the edge on rounded screens. Change to 8px.
4.  [ ] **[VP-04] Settings Field Gaps:** The `grid2` gap (12px) in Settings feels inconsistent with the `gap: 16px` used in newer panels.
5.  [ ] **[VP-05] Tab Bar Shadow:** The `.bottom-nav` top border (`var(--hair2)`) battles with the `backdrop-filter`, creating a double-border effect on some screens.
6.  [ ] **[VP-06] Icon Alignment in Buttons:** `.btn-arrow` usage with `transform: translateY(-1px)` suggests icons aren't naturally centered. Flex alignment should be fixed instead of using transforms.
7.  [ ] **[VP-07] Search Chip Spacing:** The `.chip-search` input lacks sufficient internal padding-right for the search icon, potentially overlapping text.
8.  [ ] **[VP-08] Divider Visibility:** Dotted dividers in `.timeline-track` have too low opacity (`.18`) making them invisible on some monitors.
9.  [ ] **[VP-09] Focus Ring Offset:** Global focus rings use `outline-offset: 2px` which can get cut off by `overflow: hidden` on rounded cards (e.g., `.segment`).
10. [ ] **[VP-10] Danger Zone Border:** The `danger-zone` border is `1px solid rgba(255, 106, 122, .2)` which is too subtle against the red background gradient.
11. [ ] **[VP-11] Scrollbar Track Contrast:** The webkit scrollbar track background (`var(--ink)`) matches the body background, making the scrollbar floating and disconnected.
12. [ ] **[VP-12] Tooltip Z-Index:** Native title tooltips are used; custom CSS tooltips (if any) are missing from the stylesheet, leading to inconsistent browser default behaviors.
13. [ ] **[VP-13] Text Input Placeholder Color:** `color-scheme: dark` defaults validation but placeholders in `.field-input` might be too low contrast (`var(--muted)` isn't explicitly set for placeholders).
14. [ ] **[VP-14] Card Border Consistency:** `.card` uses `var(--color-border)` while `.panel` uses hardcoded RGBA. Consolidate to tokens.
15. [ ] **[VP-15] Review Matrix Spacing:** `.review-matrix` gap of `4px` causes items to look glued together compared to the rest of the list.

### 2.2 Typography & Iconography
16. [ ] **[VP-16] Monospace Font Mixing:** `var(--font-mono)` is used in `.day-item .d` (Display) but `.day-item .right` (Metadata). The mix creates a disjointed reading experience.
17. [ ] **[VP-17] Uppercase Tracking:** `.section-title` uses `.08em` spacing while `.roster-title` uses `.06em`. Standardize all uppercase tracking to `.08em`.
18. [ ] **[VP-18] Icon Stroke Widths:** SVG icons in `.icon-btn` appear to have varied stroke widths (some 1.5px, some 2px). Normalize to 1.75px.
19. [ ] **[VP-19] Unit Labels:** "g" and "mg" labels in headers are often the same size as values. They should be `.tiny` or `.muted`.
20. [ ] **[VP-20] Empty State Typography:** Empty state messages in rosters lack a specific style, defaulting to body text which looks unintentional.
21. [ ] **[VP-21] Modal Title Hierarchy:** `.sheet-title` is only 13px, often smaller than the buttons in the sheet. Bump to 15px.
22. [ ] **[VP-22] Link Decoration:** `.link` class removes all text decoration, making links indistinguishable from colored text. Add underline on hover.
23. [ ] **[VP-23] "Tiny" Font Size:** `.tiny` class sets 12px, but some elements explicitly set 10px or 11px. Rename `.tiny` to `text-xs` (11px) and `text-xxs` (10px) for clarity.
24. [ ] **[VP-24] Legend Dot Alignment:** `.legend-dot` is flex-centered but text inside often looks 1px too high due to font baseline quirks.
25. [ ] **[VP-25] Badge Text Weight:** `.tab-badge` uses font-weight 600, but at 10px size, it reads poorly. Increase to 700.

## 3. Interaction & States (P2)

### 3.1 Feedback & Animation
26. [ ] **[IX-01] Button Active State Scale:** The `scale(.98)` on `.btn:active` is subtle. Increasing to `.96` for touch devices provides better tactile feedback.
27. [ ] **[IX-02] Checkbox Touch Area:** Native checkboxes in `.copy-item` are small (20px). They should be wrapped in a larger label or custom-styled for 44px targets.
28. [ ] **[IX-03] Sheet Dismiss Drag:** The Bottom Sheet (`.sheet-panel`) animation is CSS-only (`panelIn`). It lacks gesture support (drag to dismiss).
29. [ ] **[IX-04] Hover on Mobile:** `.day-item:hover` styles persist on mobile after tapping, leaving "stuck" hover states. Use `@media (hover: hover)`.
30. [ ] **[IX-05] Roster Delete Feedback:** Clicking the "X" in `.pill` removes it immediately. Needs a fade-out transition before DOM removal.
31. [ ] **[IX-06] Input Focus Transition:** `.field-input` transitions `border-color` but not `background`. The background lighten effect on focus is abrupt.
32. [ ] **[IX-07] Toggle Switch Animation:** (If present) Toggle switches often snap state. Ensure the knob slides.
33. [ ] **[IX-08] Long-Press Actions:** No indication that long-press might work on certain items (like History or Presets) if that feature exists.
34. [ ] **[IX-09] Scroll Chaining:** Modals/Sheets do not use `overscroll-behavior: contain`, allowing the body to scroll when the modal ends.
35. [ ] **[IX-10] Loading States:** When "Syncing", the Sync badge is static. Add a spin animation or pulse to the sync icon.

### 3.2 Form & Input Polish
36. [ ] **[IX-11] Number Input Spinners:** `.roster-input[type="number"]` still shows browser default spinners on hover in some browsers. Hide them with standard CSS.
37. [ ] **[IX-12] Keyboard Type:** "Protein/Carb/Fat" inputs likely default to text keyboards. Ensure `inputmode="decimal"` is set.
38. [ ] **[IX-13] Autosize Textarea:** `.notes-box` uses `resize: vertical` but should auto-grow to fit content to avoid scrollbars inside cards.
39. [ ] **[IX-14] Form Submission:** Pressing Enter in a roster input might not trigger "Add". Ensure explicit form submit handling.
40. [ ] **[IX-15] Select Dropdown Cursor:** `select.field-input` does not show `cursor: pointer`, confusing users about interactivity.

## 4. Mobile & Responsive (P2)

### 4.1 Touch Targets
41. [ ] **[mob-01] Tab Bar Height:** The bottom nav padding (`calc(10px + env...)`) results in a bar that might be too short on non-FaceID iPhones. Min-height should be 60px + safe area.
42. [ ] **[mob-02] Date Navigation Arrows:** The `<` and `>` buttons in `.day-head` might be smaller than 44px if padding is internal. Verify computed size.
43. [ ] **[mob-03] Segment Taps:** The `.segment` cards are clickable but the click target is the whole card. If there are internal buttons, this causes conflict.
44. [ ] **[mob-04] Toast Positioning:** `#undoToast` is `bottom: 62px`. On mobile with a bottom nav, this might overlap the nav or be physically hard to reach.
45. [ ] **[mob-05] Sheet Close Button:** If a sheet has a close button, it usually sits top-right. Ensure it has 44px hit buffer.
46. [ ] **[mob-06] Landscape Mode:** On mobile landscape, the `min-height: 100dvh` can cause issues. Ensure sticky headers don't eat all vertical space.
47. [ ] **[mob-07] Chip Wrapping:** In `.chips`, ensure `flex-wrap: wrap` is robust for narrow 320px screens (iPhone SE).
48. [ ] **[mob-08] Safe Area Left/Right:** `padding: 14px` on `.wrap` might not be enough for landscape phones with notches. Use `max(14px, env(safe-area-inset-left))`.

### 4.2 Layout Shifts
49. [ ] **[mob-09] Soft Keyboard:** Opening a keyboard on mobile often pushes the `.bottom-nav` up. Check if `position: sticky` behaves correctly or covers the input.
50. [ ] **[mob-10] Height Transitions:** When a sheet opens, the location bar collapsing can trigger a resize event, causing a jump.

## 5. Code Maintainability & Quality (P3)

### 5.1 CSS Organization
51. [ ] **[code-01] Magic Numbers:** `radial-gradient` positions (e.g., `900px 520px at 75% 10%`) are hardcoded. These should be variables or relative units.
52. [ ] **[code-02] Duplicate Focus Styles:** Focus ring styles are repeated for `.icon-btn`, `.chip`, etc. The `:focus-visible` generic rule (lines 1354-1360) is good, but specific overrides often duplicate color definitions.
53. [ ] **[code-03] Vendor Prefixes:** Analysis shows `::-webkit-scrollbar` usage. Ensure standard `scrollbar-color` is also set for Firefox.
54. [ ] **[code-04] Z-Index Management:** Z-indices are scattered (25, 120, 900, 1000, 1200, 2000, 2100). Move to a CSS variable system `--z-nav`, `--z-modal`, etc.
55. [ ] **[code-05] Unused Keyframes:** Check if `@keyframes floaty` (line 834) is actually used by any active element (it is on `.bubble`, but are bubbles used?).
56. [ ] **[code-06] Color Literal Usage:** Some backgrounds use `rgba(0,0,0,.35)` directly instead of a `--color-overlay-sm` token.
57. [ ] **[code-07] Important Overrides:** `media (prefers-reduced-motion)` uses `!important`. While necessary there, check for other `!important` misuse.
58. [ ] **[code-08] Deep Nesting:** Selectors like `.redact-home #viewToday .segment-title` have high specificity. Flatten if possible.
59. [ ] **[code-09] Legacy Comments:** Comments like `/* --- vNext UI tokens (mockup-aligned) --- */` imply a transition state. Should be finalized.
60. [ ] **[code-10] Font Loading:** `@font-face` display is `swap`. Ensure there's no major layout shift (FOUT) by matching fallback font metrics.

### 5.2 JS & Logic
61. [ ] **[code-11] Console Logs:** Ensure `console.log` is stripped or wrapped in a debug flag.
62. [ ] **[code-12] Event Listener Cleanup:** In `sync_engine.js`, explicit `removeEventListener` is good, but check `router.js` for any lingering listeners on route change.
63. [ ] **[code-13] Error Boundaries:** If rendering a `DayPanel` fails, does it crash the whole app? Needs a boundary.
64. [ ] **[code-14] LocalStorage Keys:** 'shredmaxx_sync_ping' and others are hardcoded strings. Move to constants file.
65. [ ] **[code-15] Date handling:** Usage of `new Date()` directly in `nowIso`? Ensure uniform UTC handling across the app.

## 6. Accessibility & Inclusivity (P2)

66. [ ] **[a11y-01] ARIA Labels on Buttons:** Icon-only buttons (like Close, or Arrows) in CSS often miss `aria-label`.
67. [ ] **[a11y-02] Contrast Ratios:** `.sub` text in var(--muted) might fail AAA. Check specifically on dark panels.
68. [ ] **[a11y-03] Focus Trapping:** Does the Modal/Sheet trap focus? If not, keyboard users can obtain focus behind the modal.
69. [ ] **[a11y-04] Screen Reader Hidden:** `.sky-noise`, `.vignette` should have `aria-hidden="true"`.
70. [ ] **[a11y-05] Semantic Headings:** The app uses `.section-title` (div) instead of `<h3>`. Restore semantic HTML.
71. [ ] **[a11y-06] Motion Reduction:** The `prefers-reduced-motion` block disables all animation. Ensure transitions (like opacity) still happen instantly rather than breaking the state change.
72. [ ] **[a11y-07] Status Announcements:** When "Syncing" changes to "Synced", is this announced to screen readers? (Needs `aria-live`).
73. [ ] **[a11y-08] Touch Drag Cancellation:** If a user drags a slider and their finger goes off screen, does it cancel or commit?
74. [ ] **[a11y-09] Input Labels:** Do `.roster-input` fields have associated `<label>` or `aria-label`? Often missing in dynamic lists.
75. [ ] **[a11y-10] Color Blindness:** Status bubbles (Green/Red/Yellow). Ensure they have shape or icon differences, not just color.

## 7. Next Steps
- [ ] **Batch 1:** Fix Z-Index and Spacing variables (Items 5, 51, 54).
- [ ] **Batch 2:** Audit and add ARIA labels strings (Items 66, 69, 70).
- [ ] **Batch 3:** Interaction polish - Active states and transitions (Items 26, 31, 28).
