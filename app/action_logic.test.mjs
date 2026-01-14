// @ts-check

import {
  applySegmentStatus,
  copyDaySegmentsFromSource,
  copySegmentFromSource,
  scrubRosterItemFromDay,
  setSupplementsNotesInDay,
  toggleSegmentItemInSegment,
  toggleSupplementItemInDay
} from "./action_logic.js";
import { createDefaultDay } from "./helpers.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const nowIso = "2026-01-01T00:00:00.000Z";

{
  const day = createDefaultDay();
  const seg = day.segments.ftn;
  seg.proteins.push("p1");
  const changed = applySegmentStatus(seg, "ftn", "none", nowIso);
  assert(changed, "applySegmentStatus should report change");
  assert(seg.status === "none", "status should update to none");
  assert(seg.proteins.length === 0, "segment contents cleared");
  assert(seg.tsFirst === nowIso && seg.tsLast === nowIso, "segment timestamps touched");
  assert(seg.rev === 1, "segment revision increments");
}

{
  const day = createDefaultDay();
  const seg = day.segments.lunch;
  const changed = toggleSegmentItemInSegment(seg, "lunch", "proteins", "p1", nowIso);
  assert(changed, "toggleSegmentItemInSegment should report change");
  assert(seg.proteins.includes("p1"), "item added");
  assert(seg.status === "logged", "status sync to logged");
  assert(seg.tsFirst === nowIso, "segment touched");
}

{
  const seg = { status: "unlogged" };
  const changed = toggleSegmentItemInSegment(seg, "lunch", "proteins", "p1", nowIso);
  assert(changed, "toggleSegmentItemInSegment should initialize missing arrays");
  assert(Array.isArray(seg.proteins) && seg.proteins[0] === "p1", "missing array initialized and updated");
}

{
  const base = createDefaultDay();
  const source = createDefaultDay();
  source.segments.ftn.ftnMode = "strict";
  source.segments.ftn.proteins = ["p1"];
  source.segments.dinner.fats = ["f1"];
  copyDaySegmentsFromSource(base, source, nowIso);
  assert(base.segments.ftn.ftnMode === "strict", "ftn mode copied");
  assert(!("ftnMode" in base.segments.lunch), "ftnMode removed for non-ftn segments");
  assert(base.segments.dinner.fats.includes("f1"), "segment values copied");
  assert(base.segments.dinner.tsFirst === nowIso, "segment touch applied");
  assert(base.rev === 0, "copy does not touch day");
}

{
  const day = createDefaultDay();
  day.segments.lunch.proteins = ["p1", "p2"];
  const changed = scrubRosterItemFromDay(day, "proteins", "p1", nowIso);
  assert(changed, "scrubRosterItemFromDay should report change");
  assert(!day.segments.lunch.proteins.includes("p1"), "item removed from segment");
  assert(day.segments.lunch.tsLast === nowIso, "segment touch applied");
  assert(day.rev === 0, "scrub does not touch day");
}

{
  const day = createDefaultDay();
  day.segments.lunch = null;
  const changed = scrubRosterItemFromDay(day, "proteins", "p1", nowIso);
  assert(!changed, "scrubRosterItemFromDay ignores non-object segments");
}

{
  const day = createDefaultDay();
  day.supplements = { mode: "essential", items: ["s1", "s2"], notes: "", tsLast: "" };
  const changed = scrubRosterItemFromDay(day, "supplements", "s1", nowIso);
  assert(changed, "scrubRosterItemFromDay removes supplements");
  assert(day.supplements.items.length === 1 && day.supplements.items[0] === "s2", "supplement removed");
  assert(day.supplements.tsLast === nowIso, "supplements tsLast set");
}

{
  const day = createDefaultDay();
  const changed = toggleSupplementItemInDay(day, "s1", "essential", nowIso);
  assert(changed, "toggleSupplementItemInDay should change");
  assert(day.supplements.items.includes("s1"), "supplement added");
  assert(day.supplements.mode === "none", "supplement mode preserved when set");
  assert(day.supplements.tsLast === nowIso, "supplement tsLast set");
}

{
  const day = createDefaultDay();
  const changed = setSupplementsNotesInDay(day, "note", "essential", nowIso);
  assert(changed, "setSupplementsNotesInDay should change");
  assert(day.supplements.notes === "note", "notes updated");
  const unchanged = setSupplementsNotesInDay(day, "note", "essential", "2026-01-02T00:00:00.000Z");
  assert(!unchanged, "setSupplementsNotesInDay should no-op on identical notes");
}

console.log("action logic tests: ok");
