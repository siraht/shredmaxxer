# UX/Workflow Audit (No Code Changes)

Purpose: capture UI/UX issues and polish opportunities observed in the current implementation
without modifying code. These notes are intended to guide future refinements toward a more
premium, intuitive experience.

## Top Priority (UX correctness + clarity)

1) Segment editor mental model is fuzzy
- The header mixes "window tag", "time range", and "logged time" into a single string.
- It reads like an opaque label instead of separate, meaningful fields.
- Direction: split into discrete micro-fields (Window, Last logged, Range) aligned consistently.

2) FAB behavior is ambiguous
- Floating edit button always opens "current segment" but defaults to first segment on non-today.
- That behavior can feel surprising without context.
- Direction: hide FAB when not on today, or label it explicitly ("Edit current segment").

3) Flag/status controls compete with each other
- Seed oil / collision / high-fat flags and overall status are visually equal.
- Users can miss which control is primary.
- Direction: elevate "Status" visually and group flags in a more compact secondary cluster.

4) Rotation queue is mysterious
- "Try: X [tag]" lacks explanation for why an item was selected.
- Direction: add a tiny "why" or "last used" hint per row.

5) Archive cards lack a single compliance signal
- Issue flags are present, but there is no overall "score" or summary tone.
- Direction: include a compact compliance badge (simple percent or grade) for scanning.

## Navigation + Flow

- Tab labels are terse ("CFG", "STATS") and may be cryptic for new users.
  Direction: consider full labels or first-run tooltips.

- Archive/Review use back buttons plus bottom nav, which feels redundant.
  Direction: reduce prominence of back buttons or make bottom nav the primary route control.

- Settings view looks visually "old" compared to the mockup-driven shell.
  Direction: reskin settings panels to match new tokens (chrome + panels + typography).

## Hierarchy + Visual Clarity

- Home hero feels dense (arc + time + focus + status + segments).
  Direction: add thin separators and reduce simultaneous emphasis.

- Segment card states are still ambiguous (unlogged vs none).
  Direction: add a clearer visual badge or text for "none".

- Rituals vs signals compete for attention.
  Direction: elevate rituals as primary actions and reduce signal prominence.

## Form/Input UX

- Four separate search inputs are repetitive in the segment editor.
  Direction: consider a single search bar with category filter chips or an "active category" label.
  Decision (current): keep per-section search (Option A) for clarity; revisit global search later.

- Chip grid is tight; uppercase labels reduce readability.
  Direction: increase spacing and consider mixed-case labels.

- "Add" affordance is subtle.
  Direction: make the add action visually stronger inside each grid.

## Feedback + State

- Sync status is repeated but not contextual (online/offline/safe mode).
  Direction: unify sync status with consistent color/state across screens.

- "Log" action feedback relies on toast only.
  Direction: add micro-confirmation (header flash or progress bar fill).

- Long-press to repeat segment is hidden.
  Direction: add a tooltip or first-run tip to expose the feature.

## Aesthetic Consistency

- Mixed icon sizing/stroke weights across nav/header/cards.
  Direction: standardize 16/20/24px icon sizing and stroke thickness.

- Typography weights and tracking drift by screen.
  Direction: define a consistent type scale and apply across headers/labels.

- Noise/scanline overlays feel uneven across screens.
  Direction: normalize overlay intensity per screen and respect reduced motion.

## Accessibility + Legibility

- Many labels are 9-11px and low-contrast.
  Direction: raise minimum label size and increase contrast for critical labels.

- Animation (bubbles/pulses) may distract.
  Direction: reduce motion intensity and respect reduced-motion preference.

## Information Architecture

- Archive screen mixes logs + import/export + diagnostics in one flow.
  Direction: split "Tools/Diagnostics" into a collapsible or separate section.

- Settings lacks grouping, making it feel long and dense.
  Direction: group fields by Day Timing, Sun, Focus, Sync, Privacy, Roster.

## Micro-polish Opportunities

- Inconsistent hover/pressed states across button types.
  Direction: unify motion + shadow behavior for all button styles.

- Badge geometry varies (rounded vs squared).
  Direction: choose a consistent system for pills and status chips.

- Archive mini-arc is static.
  Direction: add a subtle hover fill transition to feel more premium.
