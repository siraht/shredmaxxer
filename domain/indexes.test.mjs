// @ts-check

import { buildWeekIndexEntry, computeWeekSourceSignature, isWeekIndexFresh } from "./indexes.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const logs = {
  "2026-01-01": {
    segments: {
      ftn: { proteins: ["p1"], carbs: ["c1"], fats: ["f1"], micros: [] }
    },
    rev: 2,
    hlc: "1700000000000:0:actor-a",
    tsLast: "2026-01-01T12:00:00.000Z"
  },
  "2026-01-02": {
    segments: {
      lunch: { proteins: ["p1"], carbs: [], fats: [], micros: [] }
    },
    rev: 3,
    hlc: "1700000005000:1:actor-b",
    tsLast: "2026-01-02T12:00:00.000Z"
  }
};

const sig = computeWeekSourceSignature(["2026-01-01", "2026-01-02"], logs);
assert(sig.rev === 5, "computeWeekSourceSignature sums revs");
assert(sig.hlc === "1700000005000:1:actor-b", "computeWeekSourceSignature picks max hlc");
assert(sig.lastEdited === "2026-01-02T12:00:00.000Z", "computeWeekSourceSignature picks latest ts");

const weekEntry = buildWeekIndexEntry({
  anchorDate: new Date("2026-01-02T12:00:00.000Z"),
  logs,
  rosters: { proteins: [], carbs: [], fats: [], micros: [] },
  weekStart: 0,
  phase: ""
});

assert(weekEntry.sourceRev === 5, "buildWeekIndexEntry sets sourceRev sum");
assert(weekEntry.sourceHlc === "1700000005000:1:actor-b", "buildWeekIndexEntry sets sourceHlc");
assert(isWeekIndexFresh(weekEntry, logs) === true, "isWeekIndexFresh true when unchanged");

const changedLogs = { ...logs, "2026-01-02": { ...logs["2026-01-02"], rev: 4 } };
assert(isWeekIndexFresh(weekEntry, changedLogs) === false, "isWeekIndexFresh false when rev changes");

console.log("indexes domain tests: ok");
