// @ts-check

import { buildInsightId, computeDayInsights, computeWeekInsights, createInsightsState, dismissInsight, computeInsights, mergeInsightsState } from "./insights.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const rosters = {
  carbs: [
    { id: "c1", label: "Fruit", tags: ["carb:fruit"] },
    { id: "c2", label: "Rice", tags: ["carb:starch"] }
  ],
  fats: [
    { id: "f1", label: "Tallow", tags: ["fat:dense"] },
    { id: "f2", label: "Seed oil", tags: ["fat:seed_oil"] },
    { id: "f3", label: "Unknown oil", tags: ["fat:unknown"] }
  ],
  proteins: [],
  micros: [
    { id: "m1", label: "Garlic", tags: [] }
  ]
};

const baseSegment = {
  status: "logged",
  proteins: [],
  carbs: [],
  fats: [],
  micros: [],
  collision: "auto",
  highFatMeal: "auto",
  seedOil: "",
  notes: "",
  rev: 0
};

const day = {
  trained: true,
  segments: {
    ftn: { ...baseSegment },
    lunch: { ...baseSegment, carbs: ["c1"] },
    dinner: { ...baseSegment, carbs: ["c2"], fats: ["f1"] },
    late: { ...baseSegment }
  }
};

const dayInsights = computeDayInsights({
  day,
  dateKey: "2026-01-13",
  rosters,
  settings: { phase: "strict" }
});

assert(dayInsights.some((insight) => insight.ruleId === "training_starch_lunch"), "training starch insight fires");
assert(dayInsights.some((insight) => insight.ruleId === "collision_today"), "collision insight fires");
const trainingInsight = dayInsights.find((insight) => insight.ruleId === "training_starch_lunch");
assert(trainingInsight && trainingInsight.message.startsWith("Strict phase:"), "phase prefix included");

const seedOilDay = {
  segments: {
    ftn: { ...baseSegment },
    lunch: { ...baseSegment, fats: ["f2"], seedOil: "" },
    dinner: { ...baseSegment },
    late: { ...baseSegment }
  }
};
const seedOilInsights = computeDayInsights({
  day: seedOilDay,
  dateKey: "2026-01-14",
  rosters,
  settings: { phase: "" }
});
assert(seedOilInsights.some((insight) => insight.ruleId === "seed_oil_hint"), "seed oil hint fires");

const unknownOilDay = {
  segments: {
    ftn: { ...baseSegment },
    lunch: { ...baseSegment, fats: ["f3"], seedOil: "" },
    dinner: { ...baseSegment },
    late: { ...baseSegment }
  }
};
const unknownOilInsights = computeDayInsights({
  day: unknownOilDay,
  dateKey: "2026-01-16",
  rosters,
  settings: { phase: "" }
});
assert(unknownOilInsights.some((insight) => insight.ruleId === "seed_oil_hint"), "unknown oil hint fires");

const seedOilNoneDay = {
  segments: {
    ftn: { ...baseSegment },
    lunch: { ...baseSegment, fats: ["f2"], seedOil: "none" },
    dinner: { ...baseSegment },
    late: { ...baseSegment }
  }
};
const seedOilNoneInsights = computeDayInsights({
  day: seedOilNoneDay,
  dateKey: "2026-01-17",
  rosters,
  settings: { phase: "" }
});
assert(!seedOilNoneInsights.some((insight) => insight.ruleId === "seed_oil_hint"), "seed oil hint suppressed when set to none");

const ftnOffDay = {
  segments: {
    ftn: { ...baseSegment, status: "logged", ftnMode: "off" },
    lunch: { ...baseSegment },
    dinner: { ...baseSegment },
    late: { ...baseSegment }
  }
};
const ftnInsights = computeDayInsights({
  day: ftnOffDay,
  dateKey: "2026-01-15",
  rosters,
  settings: { phase: "" }
});
assert(ftnInsights.some((insight) => insight.ruleId === "ftn_off_today"), "ftn off insight fires");

const weekInsights = computeWeekInsights({
  logs: { "2026-01-13": day },
  rosters,
  settings: { weekStart: 0 },
  anchorDate: new Date("2026-01-13T12:00:00")
});

assert(weekInsights.some((insight) => insight.ruleId === "week_no_micros"), "week micros insight fires");

const weekWithMicros = computeWeekInsights({
  logs: { "2026-01-13": { ...day, segments: { ...day.segments, lunch: { ...day.segments.lunch, micros: ["m1"] } } } },
  rosters,
  settings: { weekStart: 0 },
  anchorDate: new Date("2026-01-13T12:00:00")
});
assert(!weekWithMicros.some((insight) => insight.ruleId === "week_no_micros"), "week micros insight suppressed when micros logged");

const emptyWeek = computeWeekInsights({
  logs: { "2026-01-13": { segments: { ftn: { ...baseSegment }, lunch: { ...baseSegment }, dinner: { ...baseSegment }, late: { ...baseSegment } } } },
  rosters,
  settings: { weekStart: 0 },
  anchorDate: new Date("2026-01-13T12:00:00")
});
assert(emptyWeek.length === 0, "week micros insight suppressed when no items logged");

const state = {
  version: 4,
  settings: { weekStart: 0 },
  rosters,
  logs: { "2026-01-13": day },
  insights: createInsightsState()
};

const computed = computeInsights({ state, anchorDate: new Date("2026-01-13T12:00:00") });
const target = computed.find((insight) => insight.ruleId === "training_starch_lunch");
assert(!!target, "insight available before dismissal");

state.insights = dismissInsight(state.insights, target);
const filtered = computeInsights({ state, anchorDate: new Date("2026-01-13T12:00:00") });
assert(!filtered.some((insight) => insight.ruleId === "training_starch_lunch"), "dismissed insight filtered");

const ids = new Set(computed.map((insight) => insight.id));
assert(ids.size === computed.length, "insight ids are unique");

const builtId = buildInsightId("day", "2026-01-13", "collision_today");
assert(builtId === "day:2026-01-13:collision_today", "buildInsightId stable format");

const mergedState = mergeInsightsState(
  { dismissed: { day: { "2026-01-13": { collision_today: "2026-01-01T00:00:00Z" } }, week: {} } },
  { dismissed: { day: { "2026-01-13": { collision_today: "2026-02-01T00:00:00Z" } }, week: {} } }
);
assert(mergedState.dismissed.day["2026-01-13"].collision_today === "2026-02-01T00:00:00Z", "mergeInsights keeps newer");

const dayOnly = computeInsights({ state, anchorDate: new Date("2026-01-13T12:00:00"), includeWeek: false });
assert(dayOnly.every((insight) => insight.scope === "day"), "includeWeek false filters week insights");
const weekOnly = computeInsights({ state, anchorDate: new Date("2026-01-13T12:00:00"), includeDay: false });
assert(weekOnly.every((insight) => insight.scope === "week"), "includeDay false filters day insights");

console.log("insights tests: ok");
