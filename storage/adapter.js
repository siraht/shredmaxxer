// @ts-check

import { idbAdapter, isIndexedDbAvailable, openDatabase } from "./idb.js";
import { localAdapter } from "./local.js";
import { checkPersistStatus, requestPersist } from "./persist.js";
import { APP_VERSION, buildMeta, isMetaEqual } from "./meta.js";
import { createInsightsState } from "../domain/insights.js";

let adapterPromise = null;
let mode = "localStorage";
let openError = null;

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
      openError = null;
      mode = "idb";
      return idbAdapter;
    }catch(e){
      openError = e;
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

export function getStorageOpenError(){
  return openError;
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
    const insights = state?.insights ? state.insights : createInsightsState();
    if(!isMetaEqual(state?.meta, nextMeta)){
      await adapter.saveMeta(nextMeta);
    }
    return { ...state, meta: nextMeta, insights };
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
  async getDayIndex(dateKey){
    const adapter = await resolveAdapter();
    if(typeof adapter.getDayIndex === "function"){
      return adapter.getDayIndex(dateKey);
    }
    return null;
  },
  async saveDayIndex(dateKey, entry){
    const adapter = await resolveAdapter();
    if(typeof adapter.saveDayIndex === "function"){
      return adapter.saveDayIndex(dateKey, entry);
    }
  },
  async listDayIndex(){
    const adapter = await resolveAdapter();
    if(typeof adapter.listDayIndex === "function"){
      return adapter.listDayIndex();
    }
    return {};
  },
  async clearDayIndex(){
    const adapter = await resolveAdapter();
    if(typeof adapter.clearDayIndex === "function"){
      return adapter.clearDayIndex();
    }
  },
  async getWeekIndex(weekKey){
    const adapter = await resolveAdapter();
    if(typeof adapter.getWeekIndex === "function"){
      return adapter.getWeekIndex(weekKey);
    }
    return null;
  },
  async saveWeekIndex(weekKey, entry){
    const adapter = await resolveAdapter();
    if(typeof adapter.saveWeekIndex === "function"){
      return adapter.saveWeekIndex(weekKey, entry);
    }
  },
  async listWeekIndex(){
    const adapter = await resolveAdapter();
    if(typeof adapter.listWeekIndex === "function"){
      return adapter.listWeekIndex();
    }
    return {};
  },
  async clearWeekIndex(){
    const adapter = await resolveAdapter();
    if(typeof adapter.clearWeekIndex === "function"){
      return adapter.clearWeekIndex();
    }
  },
  async getAuditLog(){
    const adapter = await resolveAdapter();
    if(typeof adapter.getAuditLog === "function"){
      return adapter.getAuditLog();
    }
    return [];
  },
  async saveAuditLog(log){
    const adapter = await resolveAdapter();
    if(typeof adapter.saveAuditLog === "function"){
      return adapter.saveAuditLog(log);
    }
  },
  async getOutbox(){
    const adapter = await resolveAdapter();
    if(typeof adapter.getOutbox === "function"){
      return adapter.getOutbox();
    }
    return [];
  },
  async saveOutbox(list){
    const adapter = await resolveAdapter();
    if(typeof adapter.saveOutbox === "function"){
      return adapter.saveOutbox(list);
    }
  },
  async getSyncCredentials(){
    const adapter = await resolveAdapter();
    if(typeof adapter.getSyncCredentials === "function"){
      return adapter.getSyncCredentials();
    }
    return null;
  },
  async saveSyncCredentials(creds){
    const adapter = await resolveAdapter();
    if(typeof adapter.saveSyncCredentials === "function"){
      return adapter.saveSyncCredentials(creds);
    }
  },
  async saveInsights(insights){
    const adapter = await resolveAdapter();
    if(typeof adapter.saveInsights === "function"){
      return adapter.saveInsights(insights);
    }
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
