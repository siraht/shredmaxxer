// @ts-check

import { ensureDayMeta, ensureSegmentMeta, touchDay, touchSegment } from "./revisions.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const seg = {};
ensureSegmentMeta(seg);
assert(seg.rev === 0, "segment rev default");
assert(seg.tsFirst === "", "segment tsFirst default");
assert(seg.tsLast === "", "segment tsLast default");

ensureSegmentMeta(null);
ensureSegmentMeta(undefined);
assert(true, "ensureSegmentMeta ignores non-objects");

const segBad = { rev: "nope", tsFirst: 1, tsLast: 2 };
ensureSegmentMeta(segBad);
assert(segBad.rev === 0, "ensureSegmentMeta resets invalid rev");
assert(segBad.tsFirst === "", "ensureSegmentMeta resets invalid tsFirst");
assert(segBad.tsLast === "", "ensureSegmentMeta resets invalid tsLast");

touchSegment(seg, "2026-01-01T00:00:00.000Z");
assert(seg.rev === 1, "segment rev increment");
assert(seg.tsFirst === "2026-01-01T00:00:00.000Z", "segment tsFirst set once");
assert(seg.tsLast === "2026-01-01T00:00:00.000Z", "segment tsLast set");

touchSegment(seg, "2026-01-02T00:00:00.000Z");
assert(seg.rev === 2, "segment rev increments again");
assert(seg.tsFirst === "2026-01-01T00:00:00.000Z", "segment tsFirst stable");
assert(seg.tsLast === "2026-01-02T00:00:00.000Z", "segment tsLast updates");

const segExisting = { rev: 5, tsFirst: "2025-01-01T00:00:00.000Z", tsLast: "2025-01-02T00:00:00.000Z" };
ensureSegmentMeta(segExisting);
assert(segExisting.rev === 5, "ensureSegmentMeta preserves rev");
assert(segExisting.tsFirst === "2025-01-01T00:00:00.000Z", "ensureSegmentMeta preserves tsFirst");
assert(segExisting.tsLast === "2025-01-02T00:00:00.000Z", "ensureSegmentMeta preserves tsLast");

const day = {};
ensureDayMeta(day);
assert(day.rev === 0, "day rev default");
assert(day.tsCreated === "", "day tsCreated default");
assert(day.tsLast === "", "day tsLast default");

ensureDayMeta(null);
ensureDayMeta(undefined);
assert(true, "ensureDayMeta ignores non-objects");

const dayBad = { rev: "nope", tsCreated: 1, tsLast: 2 };
ensureDayMeta(dayBad);
assert(dayBad.rev === 0, "ensureDayMeta resets invalid rev");
assert(dayBad.tsCreated === "", "ensureDayMeta resets invalid tsCreated");
assert(dayBad.tsLast === "", "ensureDayMeta resets invalid tsLast");

touchDay(day, "2026-01-01T12:00:00.000Z");
assert(day.rev === 1, "day rev increment");
assert(day.tsCreated === "2026-01-01T12:00:00.000Z", "day tsCreated set once");
assert(day.tsLast === "2026-01-01T12:00:00.000Z", "day tsLast set");

touchDay(day, "2026-01-02T12:00:00.000Z");
assert(day.rev === 2, "day rev increments again");
assert(day.tsCreated === "2026-01-01T12:00:00.000Z", "day tsCreated stable");
assert(day.tsLast === "2026-01-02T12:00:00.000Z", "day tsLast updates");

const dayExisting = { rev: 3, tsCreated: "2026-01-01T00:00:00.000Z", tsLast: "2026-01-02T00:00:00.000Z" };
ensureDayMeta(dayExisting);
assert(dayExisting.rev === 3, "ensureDayMeta preserves rev");
assert(dayExisting.tsCreated === "2026-01-01T00:00:00.000Z", "ensureDayMeta preserves tsCreated");
assert(dayExisting.tsLast === "2026-01-02T00:00:00.000Z", "ensureDayMeta preserves tsLast");

console.log("revisions tests: ok");
