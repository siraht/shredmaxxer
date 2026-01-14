// @ts-check

import { migrateV3State } from "./migrate_v3.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const legacy = {
  version: 3,
  settings: {
    dayStart: "06:00",
    dayEnd: "23:59",
    ftnEnd: "12:00",
    lunchEnd: "16:00",
    dinnerEnd: "21:00",
    sunrise: "07:00",
    sunset: "17:00",
    focusMode: "nowfade"
  },
  rosters: {
    proteins: ["Beef"],
    carbs: ["White rice"],
    fats: ["Coconut oil"],
    micros: ["Garlic"]
  },
  logs: {
    "2025-01-01": {
      segments: {
        ftn: { proteins: ["Beef"], carbs: [], fats: [], micros: [], collision: false, seedOil: "", notes: "" },
        lunch: { proteins: [], carbs: ["White rice"], fats: ["Coconut oil"], micros: [], collision: true, seedOil: "yes", notes: "" },
        dinner: { proteins: [], carbs: [], fats: [], micros: ["Garlic"], collision: "auto", seedOil: "", notes: "" },
        late: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", seedOil: "", notes: "" }
      },
      movedBeforeLunch: true,
      trained: false,
      highFatDay: "no",
      energy: "3",
      mood: "4",
      cravings: "2",
      notes: ""
    }
  }
};

const result = migrateV3State(legacy, { storageMode: "localStorage", persistStatus: "unknown" });
assert(result.version === 4, "migrated to v4");
assert(result.rosters.proteins.length === 1, "rosters migrated");
assert(typeof result.rosters.proteins[0].id === "string", "roster ids assigned");

const day = result.logs["2025-01-01"];
assert(day.segments.ftn.status === "logged", "segment status set");
assert(day.segments.lunch.collision === "yes", "boolean collision normalized to tri");
assert(day.segments.ftn.proteins[0] !== "Beef", "labels converted to ids");
assert(day.tsCreated && day.tsLast, "day timestamps set");

console.log("migrate_v3 tests: ok");
