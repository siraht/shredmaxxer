// @ts-check

import { storageAdapter, getStorageMode } from "../../storage/adapter.js";
import { isIndexedDbAvailable } from "../../storage/idb.js";
import { createSnapshotRecord } from "../../storage/snapshots.js";

export async function run({ logEvent, assert }){
  if(!isIndexedDbAvailable()){
    return { status: "skip", reason: "IndexedDB not available" };
  }

  const settings = { dayStart: "06:00", dayEnd: "23:59" };
  const rosters = { proteins: [], carbs: [], fats: [], micros: [] };
  const day = {
    segments: {
      ftn: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" },
      lunch: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" },
      dinner: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" },
      late: { proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "" }
    }
  };

  await storageAdapter.saveSettings(settings);
  await storageAdapter.saveRosters(rosters);
  await storageAdapter.saveDay("2026-01-01", day);
  await storageAdapter.saveDay("2026-01-02", day);

  const state = await storageAdapter.loadState();
  assert(state.settings.dayStart === "06:00", "settings persisted");
  assert(state.logs && state.logs["2026-01-01"], "day persisted");
  assert(state.insights && typeof state.insights === "object", "insights default present");

  const mode = await getStorageMode();
  assert(mode === "idb" || mode === "localStorage", "storage mode valid");
  if(state.meta){
    assert(state.meta.storageMode === mode, "meta storageMode matches");
    assert(state.meta.version === 4, "meta version 4");
    assert(typeof state.meta.installId === "string", "meta installId");
    const allowed = ["unknown", "granted", "denied"];
    assert(allowed.includes(state.meta.persistStatus), "meta persistStatus allowed");
  }

  const insightPayload = { version: 1, dismissed: { day: {}, week: {} } };
  await storageAdapter.saveInsights(insightPayload);
  const nextState = await storageAdapter.loadState();
  assert(nextState.insights && nextState.insights.version === 1, "insights persisted");

  const snapshot = createSnapshotRecord({
    label: "Manual",
    state: { settings, rosters, logs: { "2026-01-01": day }, meta: state.meta || {} }
  });
  await storageAdapter.saveSnapshot(snapshot);
  const snapshots = await storageAdapter.listSnapshots();
  assert(snapshots.some((s) => s.id === snapshot.id), "snapshot saved");

  await storageAdapter.restoreSnapshot(snapshot.id);
  const restored = await storageAdapter.loadState();
  assert(restored.logs && restored.logs["2026-01-01"], "snapshot restore loads logs");
  assert(!restored.logs["2026-01-02"], "snapshot restore clears other logs");

  await storageAdapter.deleteSnapshot(snapshot.id);
  const afterDelete = await storageAdapter.listSnapshots();
  assert(!afterDelete.some((s) => s.id === snapshot.id), "snapshot deleted");

  logEvent({ event: "adapter_idb", status: "ok" });
  return { status: "pass" };
}
