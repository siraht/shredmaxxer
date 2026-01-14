// @ts-check

import { migrateV3ToV4 } from "./migrate.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const v3 = {
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
    carbs: [],
    fats: [],
    micros: []
  },
  logs: {
    "2026-01-10": {
      segments: {
        ftn: { ftnMode: "ftn", proteins: ["Beef"], carbs: ["New Carb"], fats: [], micros: [], collision: true, highFatMeal: false, seedOil: "yes", notes: "" },
        lunch: { proteins: [], carbs: [], fats: [], micros: [], collision: false, highFatMeal: true, seedOil: "", notes: "" },
        dinner: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" },
        late: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "" }
      },
      movedBeforeLunch: true,
      trained: false,
      highFatDay: true,
      energy: "3",
      mood: "4",
      cravings: "2",
      notes: "test day"
    }
  }
};

const migrated = migrateV3ToV4(v3, { now: new Date("2026-01-10T12:00:00.000Z") });
assert(migrated.version === 4, "version upgraded to 4");
assert(migrated.meta && migrated.meta.installId, "meta.installId set");

const proteins = migrated.rosters.proteins;
const beef = proteins.find((item) => item.label === "Beef");
assert(!!beef, "roster includes Beef");

const carbs = migrated.rosters.carbs;
const newCarb = carbs.find((item) => item.label === "New Carb");
assert(!!newCarb, "missing log label created in roster");

const day = migrated.logs["2026-01-10"];
const seg = day.segments.ftn;
assert(seg.collision === "yes", "boolean true collision -> yes");
assert(seg.highFatMeal === "no", "boolean false highFatMeal -> no");
assert(day.highFatDay === "yes", "boolean highFatDay -> yes");
assert(seg.proteins[0] === beef.id, "labels mapped to IDs");
assert(seg.carbs[0] === newCarb.id, "missing label mapped to new ID");

const empty = migrateV3ToV4({ version: 3, rosters: {}, logs: {} });
assert(empty.rosters.proteins.length > 0, "default rosters used when empty");

console.log("migrate tests: ok");
