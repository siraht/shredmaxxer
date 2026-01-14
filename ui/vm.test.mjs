// @ts-check

import { selectTodayVm } from "./vm/today.js";
import { rosterVersion } from "./vm/memo.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const rosters = {
  proteins: [
    { id: "p1", label: "Beef", tsUpdated: "2026-01-02T00:00:00.000Z" },
    { id: "p2", label: "Eggs", tsUpdated: "2026-01-01T00:00:00.000Z" }
  ],
  carbs: [],
  fats: [],
  micros: []
};

const ver = rosterVersion(rosters);
assert(ver.startsWith("2|"), "rosterVersion counts items");
assert(ver.endsWith("2026-01-02T00:00:00.000Z"), "rosterVersion uses latest tsUpdated");

const state = {
  meta: { version: 4 },
  settings: { dayStart: "06:00", dayEnd: "23:59", ftnEnd: "12:00", lunchEnd: "16:00", dinnerEnd: "21:00" },
  rosters,
  logs: {
    "2026-01-10": {
      segments: {
        ftn: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" },
        lunch: { status: "logged", proteins: ["p1"], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" },
        dinner: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" },
        late: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" }
      },
      highFatDay: "auto",
      rev: 1
    }
  }
};

const vm = selectTodayVm(state, "2026-01-10");
assert(Array.isArray(vm.segments), "selectTodayVm returns segments array");
assert(vm.segments.map((s) => s.id).join(",") === "ftn,lunch,dinner,late", "segments ordered by protocol");

console.log("vm tests: ok");
