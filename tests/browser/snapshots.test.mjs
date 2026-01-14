// @ts-check

import { savePreImportSnapshot, savePreMigrationSnapshot, saveSnapshotWithRetention } from "../../storage/snapshots.js";
import { storageAdapter } from "../../storage/adapter.js";

export async function run({ assert }){
  if(typeof indexedDB === "undefined"){
    return { status: "skip", reason: "IndexedDB not available" };
  }

  const state = { version: 4, settings: { dayStart: "06:00" }, rosters: {}, logs: {} };
  await saveSnapshotWithRetention({ label: "One", state, adapter: storageAdapter, max: 2 });
  await saveSnapshotWithRetention({ label: "Two", state, adapter: storageAdapter, max: 2 });
  await saveSnapshotWithRetention({ label: "Three", state, adapter: storageAdapter, max: 2 });

  const list = await storageAdapter.listSnapshots();
  assert(list.length === 2, "retention prunes to max");

  const preImport = await savePreImportSnapshot({ state, adapter: storageAdapter, max: 5 });
  assert(preImport.saved.label === "Pre-import", "pre-import label");
  const preMigration = await savePreMigrationSnapshot({ state, adapter: storageAdapter, max: 5 });
  assert(preMigration.saved.label === "Pre-migration", "pre-migration label");

  return { status: "pass" };
}
