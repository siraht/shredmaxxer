// @ts-check

import { computeRecents, computeAllRecents, sortDateKeysDesc } from "./recents.js";

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

const dupLogs = {
  "2026-01-03": {
    segments: {
      ftn: { proteins: ["p1", "p2"], carbs: [], fats: [], micros: [] },
      lunch: { proteins: ["p1"], carbs: [], fats: [], micros: [] }
    }
  }
};
const deduped = computeRecents(dupLogs, "proteins", { limit: 3 });
assert(deduped.join(",") === "p1,p2", "duplicates are de-duped");

const customOrder = computeRecents(logs, "proteins", { limit: 2, segmentOrder: ["late", "dinner", "lunch", "ftn"] });
assert(customOrder[0] === "p1", "custom segment order respected");

const sortedKeys = sortDateKeysDesc(logs);
assert(sortedKeys[0] === "2026-01-02", "sortDateKeysDesc newest first");
assert(sortedKeys[1] === "2026-01-01", "sortDateKeysDesc oldest last");

const empty = computeRecents(logs, "proteins", { limit: 0 });
assert(empty.length === 0, "limit 0 returns empty");

const missingSegs = computeRecents({ "2026-01-04": {} }, "proteins", { limit: 3 });
assert(missingSegs.length === 0, "missing segments returns empty");

console.log("recents tests: ok");
