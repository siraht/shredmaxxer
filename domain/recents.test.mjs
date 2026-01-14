// @ts-check

import { computeRecents, computeAllRecents } from "./recents.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const logs = {
  "2026-01-02": {
    segments: {
      ftn: { proteins: ["p2"], carbs: ["c1"], fats: [], micros: [] },
      lunch: { proteins: ["p1"], carbs: [], fats: ["f1"], micros: [] },
      dinner: { proteins: [], carbs: ["c2"], fats: [], micros: ["m1"] },
      late: { proteins: [], carbs: [], fats: [], micros: [] }
    }
  },
  "2026-01-01": {
    segments: {
      ftn: { proteins: ["p3"], carbs: [], fats: [], micros: [] },
      lunch: { proteins: ["p1"], carbs: ["c3"], fats: ["f2"], micros: [] },
      dinner: { proteins: [], carbs: [], fats: [], micros: [] },
      late: { proteins: [], carbs: [], fats: [], micros: ["m2"] }
    }
  }
};

const proteins = computeRecents(logs, "proteins", { limit: 3 });
assert(proteins.join(",") === "p2,p1,p3", "recents order uses newest date + segment order");

const micros = computeRecents(logs, "micros", { limit: 2 });
assert(micros.join(",") === "m1,m2", "recents merges across days");

const all = computeAllRecents(logs, { limit: 1 });
assert(all.carbs.length === 1 && all.carbs[0] === "c1", "computeAllRecents returns per-category lists");

console.log("recents tests: ok");
