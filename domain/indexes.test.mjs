// @ts-check

import {
  parseDateKey,
  getWeekKeyFromDateKey,
  getDaySourceSignature,
  computeWeekSourceSignature,
  buildDayIndexEntry,
  buildWeekIndexEntry,
  isDayIndexFresh,
  isWeekIndexFresh
} from "./indexes.js";
import { dateToKey } from "./time.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const rosters = {
  proteins: [{ id: "p1", label: "Beef", tags: ["protein:red"] }],
  carbs: [{ id: "c1", label: "Rice", tags: ["carb:starch"] }],
  fats: [{ id: "f1", label: "Tallow", tags: ["fat:solid"] }],
  micros: [{ id: "m1", label: "Sauerkraut", tags: ["micro:fermented"] }]
};

const day = {
  rev: 2,
  hlc: "1700000000000:0:alpha",
  tsCreated: "2026-01-14T11:00:00.000Z",
  tsLast: "2026-01-14T12:05:00.000Z",
  energy: "2",
  mood: "3",
  cravings: "1",
  segments: {
    ftn: { ftnMode: "strict", proteins: ["p1"], carbs: [], fats: [], micros: [] },
    lunch: { proteins: ["p1"], carbs: ["c1"], fats: ["f1"], micros: ["m1"], collision: "auto", highFatMeal: "auto", seedOil: "" }
  }
};

const dayAlt = {
  rev: 1,
  hlc: "1690000000000:0:beta",
  tsCreated: "2026-01-13T10:00:00.000Z",
  segments: { lunch: { proteins: [], carbs: [], fats: [], micros: [] } }
};

const dateKey = "2026-01-14";
const otherKey = "2026-01-13";

const parsed = parseDateKey(dateKey);
assert(dateToKey(parsed) === dateKey, "parseDateKey round-trip");

const weekKey = getWeekKeyFromDateKey("2026-01-14", 1);
assert(typeof weekKey === "string" && weekKey.length === 10, "week key format");

const sig = getDaySourceSignature(day);
assert(sig.rev === 2, "day signature rev");
assert(sig.hlc === day.hlc, "day signature hlc");
assert(sig.lastEdited === day.tsLast, "day signature lastEdited prefers tsLast");

const weekSig = computeWeekSourceSignature([dateKey, otherKey], {
  [dateKey]: day,
  [otherKey]: dayAlt
});
assert(weekSig.rev === 3, "week signature rev sum");
assert(weekSig.hlc === day.hlc, "week signature max hlc");
assert(weekSig.lastEdited === day.tsLast, "week signature lastEdited max");

const indexEntry = buildDayIndexEntry(dateKey, day, rosters);
assert(indexEntry.dateKey === dateKey, "day index dateKey");
assert(indexEntry.counts.proteins === 1, "day index counts proteins");
assert(indexEntry.signals.energy === "2", "day index signals energy");
assert(indexEntry.ftnMode === "strict", "day index ftn mode");
assert(indexEntry.sourceRev === 2, "day index sourceRev");

const weekEntry = buildWeekIndexEntry({
  anchorDate: new Date(`${dateKey}T12:00:00`),
  logs: { [dateKey]: day, [otherKey]: dayAlt },
  rosters,
  weekStart: 1
});
assert(Array.isArray(weekEntry.dateKeys), "week index dateKeys");
assert(weekEntry.sourceRev === 3, "week index sourceRev");
assert(weekEntry.sourceHlc === day.hlc, "week index sourceHlc");

assert(isDayIndexFresh(indexEntry, day), "day index fresh true");
assert(!isDayIndexFresh({ ...indexEntry, sourceRev: 9 }, day), "day index fresh false when rev mismatch");

assert(isWeekIndexFresh(weekEntry, { [dateKey]: day, [otherKey]: dayAlt }), "week index fresh true");
assert(!isWeekIndexFresh({ ...weekEntry, sourceHlc: "" }, { [dateKey]: day, [otherKey]: dayAlt }), "week index fresh false when hlc mismatch");

console.log("indexes tests: ok");
