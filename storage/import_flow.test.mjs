// @ts-check

import { applyImport, mergeLogs, mergeStates } from "./import_flow.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

function createAdapter(){
  const store = [];
  return {
    store,
    async saveSnapshot(snapshot){ store.push(snapshot); },
    async listSnapshots(){ return [...store]; },
    async deleteSnapshot(id){
      const idx = store.findIndex((s) => s.id === id);
      if(idx >= 0) store.splice(idx, 1);
    }
  };
}

const base = {
  version: 4,
  meta: { version: 4, installId: "a", storageMode: "idb", persistStatus: "unknown" },
  settings: { dayStart: "06:00", dayEnd: "23:59", ftnEnd: "12:00", lunchEnd: "16:00", dinnerEnd: "21:00", focusMode: "nowfade", sunMode: "manual", sunrise: "07:00", sunset: "17:00", phase: "", privacy: { appLock: false, redactHome: false, exportEncryptedByDefault: false } },
  rosters: { proteins: [], carbs: [], fats: [], micros: [] },
  logs: {}
};

const incoming = {
  version: 4,
  meta: { version: 4, installId: "b", storageMode: "idb", persistStatus: "unknown" },
  settings: base.settings,
  rosters: base.rosters,
  logs: {}
};

const mergedLogs = mergeLogs(
  { "2025-01-01": { rev: 1, tsLast: "2025-01-01T01:00:00Z", segments: { ftn: { rev: 1, tsLast: "2025-01-01T01:00:00Z" } } } },
  { "2025-01-01": { rev: 2, tsLast: "2025-01-01T02:00:00Z", segments: { ftn: { rev: 2, tsLast: "2025-01-01T02:00:00Z" } } } }
);
assert(mergedLogs["2025-01-01"].rev === 2, "mergeLogs picks higher rev");

const mergedState = mergeStates(base, incoming);
assert(mergedState.meta.installId === "a", "mergeStates preserves base meta by default");

const adapter = createAdapter();
const result = await applyImport({ currentState: base, payload: incoming, adapter });
assert(result.ok, "applyImport ok");
assert(result.snapshot && adapter.store.length === 1, "snapshot created");

console.log("import_flow tests: ok");
