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

const scoped = computeLastUsed(logs, ["2026-01-10"]);
assert(scoped.proteins.get("a") === undefined, "scoped lastUsed ignores out-of-range");
assert(scoped.proteins.get("b") === "2026-01-10", "scoped lastUsed uses provided keys");

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

const tieState = {
  rosters: {
    proteins: [
      { id: "x", label: "Alpha" },
      { id: "y", label: "Beta" }
    ],
    carbs: [],
    fats: [],
    micros: []
  },
  logs: {}
};
const tiePicks = computeRotationPicks(tieState, { limitPerCategory: 2 });
assert(tiePicks.proteins[0].id === "x", "label tie-breaker for unseen items");

const dated = computeRotationPicks(state, { limitPerCategory: 2, dateKeys: ["2026-01-10"] });
assert(dated.proteins[0].id === "a", "dateKeys restrict last-used window");

const zeroLimit = computeRotationPicks(state, { limitPerCategory: 0 });
assert(zeroLimit.proteins.length === 0, "limit 0 returns empty picks");

console.log("rotation tests: ok");
