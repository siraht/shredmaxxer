// @ts-check

import { storageAdapter, getStorageMode } from "./adapter.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const state = await storageAdapter.loadState();
assert(state && state.meta, "loadState returns meta");
assert(state.meta.version === 4, "meta version is 4");
assert(typeof state.meta.installId === "string" && state.meta.installId.length > 0, "installId generated");

const mode = await getStorageMode();
assert(mode === "localStorage" || mode === "idb", "storage mode is valid");
assert(state.meta.storageMode === mode, "meta storageMode matches current mode");
assert(state.meta.persistStatus === "unknown" || state.meta.persistStatus === "granted" || state.meta.persistStatus === "denied", "persistStatus is valid");

console.log("adapter tests: ok");
