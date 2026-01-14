// @ts-check

import { idbAdapter, isIndexedDbAvailable, openDatabase } from "./idb.js";
import { localAdapter } from "./local.js";
import { checkPersistStatus, requestPersist } from "./persist.js";
import { APP_VERSION, buildMeta, isMetaEqual } from "./meta.js";

let adapterPromise = null;
let mode = "localStorage";

/**
 * Resolve the best available storage adapter.
 * @returns {Promise<any>}
 */
export async function resolveAdapter(){
  if(adapterPromise) return adapterPromise;

  adapterPromise = (async () => {
    if(!isIndexedDbAvailable()){
      mode = "localStorage";
      return localAdapter;
    }

    try{
      await openDatabase();
      mode = "idb";
      return idbAdapter;
    }catch(e){
      mode = "localStorage";
      adapterPromise = null;
      return localAdapter;
    }
  })();

  return adapterPromise;
}

/**
 * Report the current storage mode (idb or localStorage).
 * @returns {Promise<"idb"|"localStorage">}
 */
export async function getStorageMode(){
  await resolveAdapter();
  return mode;
}

export const storageAdapter = {
  async loadState(){
    const adapter = await resolveAdapter();
    const state = await adapter.loadState();
    let persistStatus = await requestPersist();
    if(persistStatus === "unknown"){
      persistStatus = await checkPersistStatus();
    }else if(persistStatus === "denied"){
      const checked = await checkPersistStatus();
      if(checked === "granted"){
        persistStatus = checked;
      }
    }
    const nextMeta = buildMeta(state?.meta, {
      storageMode: mode,
      persistStatus,
      appVersion: APP_VERSION
    });
    if(!isMetaEqual(state?.meta, nextMeta)){
      await adapter.saveMeta(nextMeta);
    }
    return { ...state, meta: nextMeta };
  },
  async saveDay(dateKey, dayLog){
    const adapter = await resolveAdapter();
    return adapter.saveDay(dateKey, dayLog);
  },
  async saveSettings(settings){
    const adapter = await resolveAdapter();
    return adapter.saveSettings(settings);
  },
  async saveRosters(rosters){
    const adapter = await resolveAdapter();
    return adapter.saveRosters(rosters);
  },
  async saveMeta(meta){
    const adapter = await resolveAdapter();
    return adapter.saveMeta(meta);
  },
  async listSnapshots(){
    const adapter = await resolveAdapter();
    return adapter.listSnapshots();
  },
  async saveSnapshot(snapshot){
    const adapter = await resolveAdapter();
    return adapter.saveSnapshot(snapshot);
  },
  async deleteSnapshot(snapshotId){
    const adapter = await resolveAdapter();
    return adapter.deleteSnapshot(snapshotId);
  },
  async restoreSnapshot(snapshotId){
    const adapter = await resolveAdapter();
    return adapter.restoreSnapshot(snapshotId);
  }
};

export {};
