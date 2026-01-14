// @ts-check

import { buildDayIndexEntry, buildWeekIndexEntry, getWeekKey } from "./indexes.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const rosters = {
  carbs: [{ id: "c1", tags: ["carb:starch"] }],
  fats: [{ id: "f1", tags: ["fat:dense"] }],
  proteins: [{ id: "p1", tags: [] }],
  micros: []
};

const dayA = {
  segments: {
    ftn: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", ftnMode: "ftn" },
    lunch: { proteins: ["p1"], carbs: ["c1"], fats: ["f1"], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
    dinner: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
    late: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" }
  },
  energy: "3",
  mood: "2",
  cravings: "1",
  tsLast: "2026-01-10T01:02:03.000Z",
  rev: 2
};

const dayB = {
  segments: {
    ftn: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", ftnMode: "lite" },
    lunch: { proteins: ["p1"], carbs: [], fats: [], micros: [], collision: "no", highFatMeal: "no", seedOil: "", notes: "" },
    dinner: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "yes", notes: "" },
    late: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" }
  },
  energy: "",
  mood: "",
  cravings: "",
  tsLast: "2026-01-11T01:02:03.000Z",
  rev: 5
};

const dayEntry = buildDayIndexEntry({ dateKey: "2026-01-10", day: dayA, rosters });
assert(dayEntry.counts.proteins === 1, "day counts proteins");
assert(dayEntry.counts.carbs === 1, "day counts carbs");
assert(dayEntry.flags.collision === true, "collision auto from fat:dense + carb:starch");
assert(dayEntry.flags.highFat === true, "high-fat auto from fat:dense");
assert(dayEntry.ftnMode === "ftn", "ftn mode captured");
assert(dayEntry.signals.energy === "3", "signals captured");

const logs = {
  "2026-01-10": dayA,
  "2026-01-11": dayB
};

const weekEntry = buildWeekIndexEntry({
  weekKey: "2026-01-05",
  dateKeys: ["2026-01-10", "2026-01-11"],
  logs,
  rosters,
  weekStart: 1,
  phase: ""
});
assert(weekEntry.uniqueCounts.proteins === 1, "week unique proteins");
assert(weekEntry.issueFrequency.collisionDays === 1, "week collision days");
assert(weekEntry.issueFrequency.seedOilDays === 1, "week seed oil days");
assert(weekEntry.ftnSummary.strict === 1, "week ftn strict count");
assert(weekEntry.ftnSummary.lite === 1, "week ftn lite count");

const weekKey = getWeekKey("2026-01-10", 0);
assert(weekKey === "2026-01-04", "weekKey respects Sunday week start");

console.log("indexes tests: ok");
