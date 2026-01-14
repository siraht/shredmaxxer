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

touchSegment(seg, "2026-01-01T00:00:00.000Z");
assert(seg.rev === 1, "segment rev increment");
assert(seg.tsFirst === "2026-01-01T00:00:00.000Z", "segment tsFirst set once");
assert(seg.tsLast === "2026-01-01T00:00:00.000Z", "segment tsLast set");

touchSegment(seg, "2026-01-02T00:00:00.000Z");
assert(seg.rev === 2, "segment rev increments again");
assert(seg.tsFirst === "2026-01-01T00:00:00.000Z", "segment tsFirst stable");
assert(seg.tsLast === "2026-01-02T00:00:00.000Z", "segment tsLast updates");

const day = {};
ensureDayMeta(day);
assert(day.rev === 0, "day rev default");
assert(day.tsCreated === "", "day tsCreated default");
assert(day.tsLast === "", "day tsLast default");

touchDay(day, "2026-01-01T12:00:00.000Z");
assert(day.rev === 1, "day rev increment");
assert(day.tsCreated === "2026-01-01T12:00:00.000Z", "day tsCreated set once");
assert(day.tsLast === "2026-01-01T12:00:00.000Z", "day tsLast set");

touchDay(day, "2026-01-02T12:00:00.000Z");
assert(day.rev === 2, "day rev increments again");
assert(day.tsCreated === "2026-01-01T12:00:00.000Z", "day tsCreated stable");
assert(day.tsLast === "2026-01-02T12:00:00.000Z", "day tsLast updates");

console.log("revisions tests: ok");
