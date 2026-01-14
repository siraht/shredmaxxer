// @ts-check

import { computeLastUsed, computeRotationPicks } from "./rotation.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const logs = {
  "2026-01-12": {
    segments: {
      ftn: { proteins: ["a"], carbs: [], fats: [], micros: [] },
      lunch: { proteins: [], carbs: [], fats: [], micros: [] },
      dinner: { proteins: [], carbs: [], fats: [], micros: [] },
      late: { proteins: [], carbs: [], fats: [], micros: [] }
    }
  },
  "2026-01-10": {
    segments: {
      ftn: { proteins: ["b"], carbs: ["c"], fats: [], micros: [] },
      lunch: { proteins: [], carbs: [], fats: [], micros: [] },
      dinner: { proteins: [], carbs: [], fats: [], micros: [] },
      late: { proteins: [], carbs: [], fats: [], micros: [] }
    }
  }
};

const lastUsed = computeLastUsed(logs);
assert(lastUsed.proteins.get("a") === "2026-01-12", "last used tracks newest");
assert(lastUsed.proteins.get("b") === "2026-01-10", "b last used tracked");
assert(lastUsed.carbs.get("c") === "2026-01-10", "carb last used tracked");

const state = {
  rosters: {
    proteins: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
      { id: "d", label: "Delta" }
    ],
    carbs: ["c", "e"],
    fats: [],
    micros: [{ id: "m", label: "Micro", archived: true }]
  },
  logs
};

const picks = computeRotationPicks(state, { limitPerCategory: 2 });
assert(picks.proteins.length === 2, "protein picks limited");
assert(picks.proteins[0].id === "d", "never used comes first");
assert(picks.proteins[1].id === "b", "older used comes before newer");
assert(picks.carbs[0].id === "e", "unseen carb picked first");
assert(picks.micros.length === 0, "archived items excluded");

console.log("rotation tests: ok");
