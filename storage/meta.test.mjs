// @ts-check

import { buildMeta, isMetaEqual } from "./meta.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const existing = {
  installId: "install-123",
  appVersion: "0.1.0",
  storageMode: "idb",
  persistStatus: "granted",
  sync: { mode: "hosted", status: "idle" },
  integrity: { safeMode: false },
  lastSnapshotTs: "2026-01-01T00:00:00Z"
};

const next = buildMeta(existing, {
  storageMode: "localStorage",
  persistStatus: "denied",
  appVersion: "1.2.3"
});

assert(next.version === 4, "meta version set");
assert(next.installId === "install-123", "meta preserves installId");
assert(next.appVersion === "1.2.3", "meta uses appVersion param");
assert(next.storageMode === "localStorage", "meta uses storageMode param");
assert(next.persistStatus === "denied", "meta uses persistStatus param");
assert(next.sync?.mode === "hosted", "meta preserves sync fields");
assert(next.integrity?.safeMode === false, "meta preserves integrity fields");
assert(next.lastSnapshotTs === "2026-01-01T00:00:00Z", "meta preserves lastSnapshotTs");

const generated = buildMeta(null, {
  storageMode: "idb",
  persistStatus: "unknown"
});
assert(typeof generated.installId === "string" && generated.installId.length > 0, "meta generates installId");

assert(isMetaEqual(next, { ...next }), "isMetaEqual true for same values");
assert(!isMetaEqual(next, { ...next, appVersion: "2.0.0" }), "isMetaEqual false when appVersion differs");
assert(!isMetaEqual(null, next), "isMetaEqual false on null");

console.log("meta tests: ok");
