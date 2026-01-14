// @ts-check

import { savePreImportSnapshot, savePreMigrationSnapshot } from "./snapshots.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

function createAdapter(){
  const store = [];
  return {
    store,
    async saveSnapshot(snapshot){
      store.push(snapshot);
    },
    async listSnapshots(){
      return [...store];
    },
    async deleteSnapshot(id){
      const idx = store.findIndex((s) => s.id === id);
      if(idx >= 0) store.splice(idx, 1);
    }
  };
}

const adapter = createAdapter();
const state = { version: 4 };

const result1 = await savePreImportSnapshot({ state, adapter, max: 5 });
assert(result1.saved.label === "Pre-import", "pre-import snapshot label");
assert(adapter.store.length === 1, "snapshot saved");

const result2 = await savePreMigrationSnapshot({ state, adapter, max: 5 });
assert(result2.saved.label === "Pre-migration", "pre-migration snapshot label");
assert(adapter.store.length === 2, "second snapshot saved");

console.log("snapshots tests: ok");
