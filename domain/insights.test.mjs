// @ts-check

import { computeDayInsights, computeWeekInsights, createInsightsState, dismissInsight, computeInsights } from "./insights.js";

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
    { id: "f2", label: "Seed oil", tags: ["fat:seed_oil"] }
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

const weekInsights = computeWeekInsights({
  logs: { "2026-01-13": day },
  rosters,
  settings: { weekStart: 0 },
  anchorDate: new Date("2026-01-13T12:00:00")
});

assert(weekInsights.some((insight) => insight.ruleId === "week_no_micros"), "week micros insight fires");

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

console.log("insights tests: ok");
