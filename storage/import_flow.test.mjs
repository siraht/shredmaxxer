// @ts-check

import { mergeLogs, mergeStates, sanitizeImportPayload } from "./import_flow.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
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
assert(mergedLogs["2025-01-01"].segments.ftn.rev === 2, "mergeLogs picks higher segment rev");

const mergedWithNew = mergeLogs(
  { "2025-01-01": { rev: 1, segments: { ftn: { rev: 1 } } } },
  { "2025-01-02": { rev: 1, segments: { ftn: { rev: 1 } } } }
);
assert(!!mergedWithNew["2025-01-02"], "mergeLogs adds new day");

const mergedState = mergeStates(base, incoming);
assert(mergedState.meta.installId === "a", "mergeStates preserves base meta by default");
assert(mergedState.settings.dayStart === "06:00", "mergeStates preserves base settings");

const overrideState = mergeStates(base, incoming, { overrideMeta: true, overrideSettings: true });
assert(overrideState.meta.installId === "b", "override meta from incoming");
assert(overrideState.settings.dayStart === "06:00", "override settings keeps incoming value");

const sanitized = sanitizeImportPayload({
  version: 4,
  meta: {},
  settings: { privacy: { appLock: true, appLockHash: "secret", redactHome: false, exportEncryptedByDefault: false } },
  rosters: {},
  logs: {}
});
assert(!Object.prototype.hasOwnProperty.call(sanitized.settings.privacy, "appLockHash"), "sanitize removes appLockHash");

console.log("import_flow tests: ok");
