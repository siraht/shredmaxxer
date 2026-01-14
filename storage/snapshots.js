// @ts-check

import { storageAdapter } from "./adapter.js";

const MAX_SNAPSHOTS = 7;
const PRE_IMPORT_LABEL = "Pre-import";
const PRE_MIGRATION_LABEL = "Pre-migration";

function generateId(){
  if(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"){
    return crypto.randomUUID();
  }

  if(typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"){
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
  }

  let d = Date.now();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * @param {any} state
 * @param {Date} [now]
 * @returns {string}
 */
export function serializeSnapshotPayload(state, now){
  const at = now instanceof Date ? now : new Date();
  return JSON.stringify({
    state,
    exportedAt: at.toISOString()
  });
}

/**
 * @param {{label:string, state:any, now?:Date}} opts
 * @returns {{id:string, ts:string, label:string, payload:string}}
 */
export function createSnapshotRecord(opts){
  const now = opts.now instanceof Date ? opts.now : new Date();
  return {
    id: generateId(),
    ts: now.toISOString(),
    label: opts.label,
    payload: serializeSnapshotPayload(opts.state, now)
  };
}

/**
 * @param {Array<{id:string, ts:string}>} snapshots
 * @returns {Array<{id:string, ts:string}>}
 */
export function sortSnapshotsNewest(snapshots){
  const list = Array.isArray(snapshots) ? [...snapshots] : [];
  return list.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

/**
 * @param {Array<{id:string, ts:string}>} snapshots
 * @param {number} [max]
 * @returns {{keep:any[], remove:any[]}}
 */
export function planSnapshotPrune(snapshots, max){
  const limit = Number.isFinite(max) ? Math.max(0, max) : MAX_SNAPSHOTS;
  const sorted = sortSnapshotsNewest(snapshots);
  const keep = sorted.slice(0, limit);
  const remove = sorted.slice(limit);
  return { keep, remove };
}

/**
 * Save a snapshot and prune to the max retention.
 * @param {{label:string, state:any, adapter?:any, max?:number}} opts
 * @returns {Promise<{saved:any, removed:any[]}>}
 */
export async function saveSnapshotWithRetention(opts){
  const adapter = opts.adapter || storageAdapter;
  const record = createSnapshotRecord({ label: opts.label, state: opts.state });
  await adapter.saveSnapshot(record);

  const list = await adapter.listSnapshots();
  const { remove } = planSnapshotPrune(list, opts.max);
  for(const snapshot of remove){
    if(snapshot && snapshot.id){
      await adapter.deleteSnapshot(snapshot.id);
    }
  }

  return { saved: record, removed: remove };
}

/**
 * Save a labeled snapshot before import.
 * @param {{state:any, adapter?:any, max?:number}} opts
 * @returns {Promise<{saved:any, removed:any[]}>}
 */
export async function savePreImportSnapshot(opts){
  return saveSnapshotWithRetention({
    state: opts.state,
    adapter: opts.adapter,
    max: opts.max,
    label: PRE_IMPORT_LABEL
  });
}

/**
 * Save a labeled snapshot before migration.
 * @param {{state:any, adapter?:any, max?:number}} opts
 * @returns {Promise<{saved:any, removed:any[]}>}
 */
export async function savePreMigrationSnapshot(opts){
  return saveSnapshotWithRetention({
    state: opts.state,
    adapter: opts.adapter,
    max: opts.max,
    label: PRE_MIGRATION_LABEL
  });
}

export { MAX_SNAPSHOTS, PRE_IMPORT_LABEL, PRE_MIGRATION_LABEL };

export {};
