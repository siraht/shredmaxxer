// @ts-check

import {
  clearSegmentContents,
  createDefaultDay,
  mergeSettings,
  segmentHasContent,
  syncSegmentStatus
} from "./helpers.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const merged = mergeSettings(
  { privacy: { appLock: true, appLockHash: "abc" } },
  { privacy: { blurOnBackground: true } }
);
assert(merged.privacy.appLock === true, "mergeSettings preserves base privacy");
assert(merged.privacy.blurOnBackground === true, "mergeSettings merges privacy");
assert(!("appLockHash" in merged.privacy), "mergeSettings strips appLockHash");

const day = createDefaultDay();
assert(day.segments.ftn.status === "unlogged", "default day sets segment status");
assert(Array.isArray(day.segments.lunch.proteins), "default day arrays present");
assert(day.supplements.mode === "none", "default day supplements mode");

const seg = { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" };
assert(segmentHasContent(seg, "lunch") === false, "segmentHasContent false for empty");
seg.proteins.push("p1");
assert(segmentHasContent(seg, "lunch") === true, "segmentHasContent true with items");
seg.proteins = [];
seg.collision = "";
assert(segmentHasContent(seg, "lunch") === false, "segmentHasContent treats empty tri as auto");

const ftn = { ...seg, ftnMode: "lite" };
assert(segmentHasContent(ftn, "ftn") === true, "segmentHasContent true for ftnMode");

const syncSeg = { ...seg, status: "unlogged" };
syncSegmentStatus(syncSeg, "lunch");
assert(syncSeg.status === "unlogged", "syncSegmentStatus keeps unlogged when empty");
syncSeg.proteins = ["p1"];
syncSegmentStatus(syncSeg, "lunch");
assert(syncSeg.status === "logged", "syncSegmentStatus sets logged with content");
syncSeg.status = "none";
syncSeg.proteins = [];
syncSegmentStatus(syncSeg, "lunch");
assert(syncSeg.status === "none", "syncSegmentStatus preserves none");

const clearSeg = { status: "logged", proteins: ["p1"], carbs: ["c1"], fats: ["f1"], micros: ["m1"], collision: "yes", highFatMeal: "no", seedOil: "yes", notes: "x", ftnMode: "strict" };
clearSegmentContents(clearSeg, "ftn");
assert(clearSeg.proteins.length === 0 && clearSeg.micros.length === 0, "clearSegmentContents clears arrays");
assert(clearSeg.collision === "auto" && clearSeg.highFatMeal === "auto", "clearSegmentContents resets flags");
assert(clearSeg.seedOil === "" && clearSeg.notes === "", "clearSegmentContents clears notes/seedOil");
assert(clearSeg.ftnMode === "", "clearSegmentContents resets ftnMode");

console.log("helpers tests: ok");
