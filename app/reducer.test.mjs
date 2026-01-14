// @ts-check

import { reducer } from "./reducer.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const base = {
  settings: { dayStart: "06:00" },
  rosters: { proteins: [] },
  logs: {}
};

const nextSettings = reducer(base, { type: "SET_SETTINGS", payload: { dayStart: "07:00" } });
assert(nextSettings.settings.dayStart === "07:00", "SET_SETTINGS updates settings");

const nextRosters = reducer(base, { type: "SET_ROSTERS", payload: { proteins: ["p1"] } });
assert(Array.isArray(nextRosters.rosters.proteins), "SET_ROSTERS updates rosters");
assert(nextRosters.rosters.proteins.length === 1, "SET_ROSTERS payload applied");

const upsert = reducer(base, { type: "UPSERT_DAY", payload: { dateKey: "2026-01-01", day: { segments: {} } } });
assert(upsert.logs["2026-01-01"], "UPSERT_DAY writes day log");

const patched = reducer({ ...base, logs: { "2026-01-01": { notes: "old" } } }, {
  type: "PATCH_DAY",
  payload: { dateKey: "2026-01-01", patch: { notes: "new" } }
});
assert(patched.logs["2026-01-01"].notes === "new", "PATCH_DAY merges patch");

const unchanged = reducer(base, { type: "UNKNOWN" });
assert(unchanged === base, "unknown action returns same state");

console.log("reducer tests: ok");
