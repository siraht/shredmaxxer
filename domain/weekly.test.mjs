// @ts-check

import {
  collectWeeklySets,
  computeSegmentCoverage,
  computeIssueFrequency,
  computeWeeklySummary,
  computeWeeklyUniqueCounts,
  getPhaseTargetLabel,
  summarizeFtnModes,
  getWeekDateKeys,
  getWeekStartDate
} from "./weekly.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const logs = {
  "2026-01-12": {
    highFatDay: true,
    segments: {
      ftn: { status: "logged", ftnMode: "strict", proteins: ["p1"], carbs: [], fats: [], micros: [] },
      lunch: { status: "none", proteins: ["p2"], carbs: ["c1"], fats: ["f1"], micros: ["m1"], seedOil: "yes", collision: "auto", highFatMeal: "auto" }
    }
  },
  "2026-01-13": {
    segments: {
      ftn: { status: "logged", ftnMode: "lite", proteins: ["p1"], carbs: ["c2"], fats: ["f1"], micros: [] },
      dinner: { status: "unlogged", proteins: [], carbs: [], fats: ["f2"], micros: ["m2"], collision: "yes" }
    }
  }
};

const dateKeys = ["2026-01-12", "2026-01-13", "2026-01-14"];
const counts = computeWeeklyUniqueCounts(logs, dateKeys);
assert(counts.proteins === 2, "unique proteins count");
assert(counts.carbs === 2, "unique carbs count");
assert(counts.fats === 2, "unique fats count");
assert(counts.micros === 2, "unique micros count");
assert(counts.sets.proteins.has("p1"), "unique sets include p1");
assert(counts.sets.carbs.has("c1"), "unique sets include c1");

const sets = collectWeeklySets(logs, dateKeys);
assert(sets.proteins.size === 2, "collectWeeklySets proteins size");
assert(sets.micros.has("m2"), "collectWeeklySets includes micros");

const ftn = summarizeFtnModes(logs, dateKeys);
assert(ftn.strict === 1, "ftn strict count");
assert(ftn.lite === 1, "ftn lite count");
assert(ftn.off === 0, "ftn off count");
assert(ftn.unset === 0, "ftn unset count");
assert(ftn.days === 3, "ftn days count");
assert(ftn.loggedDays === 2, "ftn logged days count");

const coverage = computeSegmentCoverage(logs, dateKeys);
assert(coverage.ftn.logged === 2, "coverage ftn logged");
assert(coverage.ftn.unlogged === 1, "coverage ftn unlogged");
assert(coverage.ftn.none === 0, "coverage ftn none");
assert(coverage.lunch.none === 1, "coverage lunch none");
assert(coverage.lunch.unlogged === 2, "coverage lunch unlogged");
assert(coverage.dinner.unlogged === 3, "coverage dinner unlogged");
assert(coverage.late.unlogged === 3, "coverage late unlogged");

const rosters = {
  carbs: [{ id: "c1", label: "Starch", tags: ["carb:starch"] }, { id: "c2", label: "Fruit", tags: ["carb:fruit"] }],
  fats: [{ id: "f1", label: "Tallow", tags: ["fat:dense"] }, { id: "f2", label: "Olive", tags: [] }],
  proteins: [],
  micros: []
};
const issues = computeIssueFrequency(logs, dateKeys, rosters);
assert(issues.collisionDays === 2, "collision days count");
assert(issues.seedOilDays === 1, "seed oil days count");
assert(issues.highFatMealDays === 2, "high-fat meal days count");
assert(issues.highFatDayDays === 1, "high-fat day toggle count");

const summary = computeWeeklySummary({
  logs,
  rosters,
  anchorDate: new Date("2026-01-13T12:00:00"),
  weekStart: 1,
  phase: ""
});
assert(Array.isArray(summary.correlations), "summary correlations array");
assert(summary.dateKeys.length === 7, "summary has 7 date keys");
assert(summary.matrix.length === 7, "summary matrix has 7 rows");
assert(summary.phaseLabel === "", "phase label empty by default");

const anchor = new Date("2026-01-13T12:00:00");
const weekStart = getWeekStartDate(anchor, 1);
assert(weekStart.getDay() === 1, "week start Monday");
const keys = getWeekDateKeys(anchor, 1);
assert(keys.length === 7, "week keys length");
const sundayStart = getWeekStartDate(anchor, 0);
assert(sundayStart.getDay() === 0, "week start Sunday");

assert(getPhaseTargetLabel("strict").length > 0, "phase label strict");
assert(getPhaseTargetLabel("maintenance").length > 0, "phase label maintenance");
assert(getPhaseTargetLabel("advanced").length > 0, "phase label advanced");
assert(getPhaseTargetLabel("") === "", "phase label empty");

console.log("weekly tests: ok");
