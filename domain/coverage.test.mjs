// @ts-check

import { computeDayCoverage, computeCoverageMatrix } from "./coverage.js";

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

const day = {
  segments: {
    lunch: {
      proteins: [],
      carbs: ["c1"],
      fats: ["f1"],
      micros: [],
      collision: "auto",
      highFatMeal: "auto",
      seedOil: "",
      notes: ""
    }
  }
};

const coverage = computeDayCoverage(day, rosters);
assert(coverage.counts.carbs === 1, "carb count");
assert(coverage.counts.fats === 1, "fat count");
assert(coverage.flags.collision, "collision auto true");
assert(coverage.flags.highFat, "high-fat auto true");
assert(!coverage.flags.seedOil, "seed oil false");

const logs = {
  "2026-01-10": day,
  "2026-01-11": { segments: {} }
};
const matrix = computeCoverageMatrix(logs, rosters, ["2026-01-10", "2026-01-11"]);
assert(matrix.length === 2, "matrix length");
assert(matrix[1].counts.carbs === 0, "missing day has zeros");

console.log("coverage tests: ok");
