# Solar Log v4 — Performance Budget

## Targets (manual budget)
- **Today view initial load:** < 1s on a mid‑range mobile device.
- **Primary logging flow:** < 10s to open a segment, log items/flags, and close.

## How to measure
1. Open DevTools → Performance or Lighthouse (mobile emulation recommended).
2. Reload the app and measure:
   - Time to interactive for Today view.
   - Time to first render of timeline + segment counts.
3. Logging flow timing:
   - Start timer when tapping a segment.
   - Stop timer after closing the segment sheet with selections and notes.
   - Repeat 3x and take the average.

## Notes
- Record device + browser + version in any performance report.
- Any regression beyond budget should be treated as a P0 blocker.
