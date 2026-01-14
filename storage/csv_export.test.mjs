// @ts-check

import { buildCsvExport } from "./csv_export.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const state = {
  settings: { phase: "strict" },
  rosters: {
    proteins: [{ id: "p1", label: "Beef" }],
    carbs: [{ id: "c1", label: "Rice", tags: ["carb:starch"] }],
    fats: [{ id: "f1", label: "Butter", tags: ["fat:dense"] }],
    micros: []
  },
  logs: {
    "2026-01-12": {
      movedBeforeLunch: true,
      trained: false,
      highFatDay: true,
      energy: "3",
      mood: "2",
      cravings: "1",
      segments: {
        ftn: { ftnMode: "strict", proteins: ["p1"], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" },
        lunch: { proteins: [], carbs: ["c1"], fats: ["f1"], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" },
        dinner: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" },
        late: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" }
      }
    }
  }
};

const csv = buildCsvExport(state);
const lines = csv.split("\n");
assert(lines.length === 2, "one data row");
assert(lines[0].startsWith("date,phase,energy"), "header starts with date/phase");
assert(lines[1].includes("2026-01-12"), "row includes date");
assert(lines[1].includes("Beef"), "row includes label");
assert(lines[1].includes(",1,0,1,"), "boolean fields encoded");
assert(lines[1].includes(",1,0,1,"), "issue counts encoded");

console.log("csv export tests: ok");
