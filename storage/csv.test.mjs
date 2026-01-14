// @ts-check

import { buildCsvRows, serializeCsv } from "./csv.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const state = {
  settings: { phase: "strict" },
  rosters: {
    carbs: [{ id: "c1", label: "Rice", tags: ["carb:starch"] }],
    fats: [{ id: "f1", label: "Butter", tags: ["fat:dense"] }],
    proteins: [{ id: "p1", label: "Beef", tags: [] }],
    micros: []
  },
  logs: {
    "2026-01-02": {
      segments: {
        ftn: { ftnMode: "ftn", proteins: ["p1"], carbs: ["c1"], fats: ["f1"], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
        lunch: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "yes", notes: "" },
        dinner: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
        late: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" }
      },
      movedBeforeLunch: true,
      trained: false,
      highFatDay: false,
      energy: "3",
      mood: "4",
      cravings: "2",
      notes: "day two"
    },
    "2026-01-01": {
      segments: {
        ftn: { ftnMode: "", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
        lunch: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
        dinner: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
        late: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" }
      },
      movedBeforeLunch: false,
      trained: false,
      highFatDay: false,
      energy: "",
      mood: "",
      cravings: "",
      notes: ""
    }
  }
};

const { header, rows } = buildCsvRows(state);
assert(header.includes("ftn_proteins"), "header includes segment columns");
assert(rows.length === 2, "rows include two days");
assert(rows[0][0] === "2026-01-01", "rows sorted by DateKey asc");

const dayTwo = rows[1];
const collisionCount = dayTwo[8];
const seedOilCount = dayTwo[9];
const highFatCount = dayTwo[10];
assert(collisionCount === "1", "collision count computed");
assert(seedOilCount === "1", "seed oil count computed");
assert(highFatCount === "1", "high-fat meal count computed");

const ftnProteins = dayTwo[12];
assert(ftnProteins === "Beef", "IDs mapped to labels");

const csv = serializeCsv(state);
assert(csv.includes("2026-01-02"), "serializeCsv includes data");

const edgeState = {
  settings: { phase: "strict" },
  rosters: {
    proteins: [{ id: "p1", label: "Fish, \"Salmon\"" }],
    carbs: [],
    fats: [],
    micros: []
  },
  logs: {
    "2026-01-03": {
      segments: {
        ftn: { ftnMode: "ftn", proteins: ["p1"], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
        lunch: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
        dinner: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
        late: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" }
      },
      movedBeforeLunch: false,
      trained: false,
      highFatDay: false,
      energy: "",
      mood: "",
      cravings: "",
      notes: "note, \"quoted\"\nline2"
    }
  }
};

const edgeCsv = serializeCsv(edgeState);
assert(edgeCsv.includes("\"Fish, \"\"Salmon\"\"\""), "labels with commas/quotes are escaped");
assert(edgeCsv.includes("\"note, \"\"quoted\"\"\nline2\""), "notes with commas/quotes/newlines are escaped");

console.log("csv tests: ok");
