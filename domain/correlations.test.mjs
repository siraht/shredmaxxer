// @ts-check

import { computeReviewCorrelations } from "./correlations.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const rosters = {
  carbs: [{ id: "c1", label: "Starch", tags: ["carb:starch"] }],
  fats: [{ id: "f1", label: "Tallow", tags: ["fat:dense"] }],
  proteins: [],
  micros: []
};

const logs = {
  "2026-01-10": {
    energy: "4",
    cravings: "2",
    segments: {
      ftn: { ftnMode: "ftn", proteins: [], carbs: [], fats: [], micros: [] },
      lunch: { proteins: [], carbs: ["c1"], fats: ["f1"], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" }
    }
  },
  "2026-01-11": {
    energy: "2",
    cravings: "4",
    segments: {
      ftn: { ftnMode: "off", proteins: [], carbs: [], fats: [], micros: [] },
      dinner: { proteins: [], carbs: [], fats: [], micros: [], collision: "no", seedOil: "yes" }
    }
  }
};

const correlations = computeReviewCorrelations(logs, rosters, ["2026-01-10", "2026-01-11"]);
const collision = correlations.find((c) => c.id === "cravings-collision");
assert(collision && collision.a.count === 1, "collision days count");
assert(collision && collision.b.count === 1, "non-collision days count");

const energy = correlations.find((c) => c.id === "energy-ftn");
assert(energy && energy.a.count === 1, "ftn strict count");
assert(energy && energy.b.count === 1, "ftn off count");

console.log("correlation tests: ok");
