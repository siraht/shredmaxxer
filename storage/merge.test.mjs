// @ts-check

import { mergeSegment, mergeDay, mergeRosterList } from "./merge.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const segA = {
  proteins: ["a"],
  carbs: [],
  fats: [],
  micros: [],
  collision: "",
  seedOil: "",
  highFatMeal: "",
  notes: "",
  rev: 1,
  tsLast: "2026-01-01T10:00:00.000Z"
};

const segB = {
  proteins: ["b"],
  carbs: [],
  fats: [],
  micros: [],
  collision: "",
  seedOil: "",
  highFatMeal: "",
  notes: "",
  rev: 2,
  tsLast: "2026-01-01T12:00:00.000Z"
};

const mergedSeg = mergeSegment(segA, segB);
assert(mergedSeg.proteins[0] === "b", "winner-takes segment by rev");

const mergedUnion = mergeSegment(segA, segB, { unionItems: true });
assert(mergedUnion.proteins.length === 2, "union merges arrays when enabled");

const dayA = { rev: 1, tsLast: "2026-01-01T10:00:00.000Z", segments: { ftn: segA } };
const dayB = { rev: 2, tsLast: "2026-01-01T12:00:00.000Z", segments: { ftn: segB } };
const mergedDay = mergeDay(dayA, dayB);
assert(mergedDay.rev === 2, "day merge picks winner by rev");
assert(mergedDay.segments.ftn.proteins[0] === "b", "segment merged inside day");

const listA = [{ id: "1", label: "Beef", tsUpdated: "2026-01-01T00:00:00.000Z" }];
const listB = [{ id: "2", label: "beef", tsUpdated: "2026-01-02T00:00:00.000Z" }];
const mergedList = mergeRosterList(listA, listB, { dedupeByLabel: true });
assert(mergedList.length === 1, "dedupe by label keeps one item");

console.log("merge tests: ok");
