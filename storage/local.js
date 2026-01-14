// @ts-check

const KEY_META = "shredmaxx_v4_meta";
const KEY_SETTINGS = "shredmaxx_v4_settings";
const KEY_ROSTERS = "shredmaxx_v4_rosters";
const KEY_INSIGHTS = "shredmaxx_v4_insights";
const KEY_LOGS = "shredmaxx_v4_logs";
const KEY_SNAPSHOTS = "shredmaxx_v4_snapshots";

function hasLocalStorage(){
  return typeof localStorage !== "undefined";
}

function readJson(key, fallback){
  try{
    if(!hasLocalStorage()) return fallback;
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch(e){
    return fallback;
  }
}

function writeJson(key, value){
  try{
    if(!hasLocalStorage()) return;
    localStorage.setItem(key, JSON.stringify(value));
  }catch(e){
    // localStorage can throw (e.g., blocked or quota). Silently drop.
  }
}

/**
 * localStorage adapter (fallback).
 */
export const localAdapter = {
  async loadState(){
    return {
      meta: readJson(KEY_META, null),
      settings: readJson(KEY_SETTINGS, null),
      rosters: readJson(KEY_ROSTERS, null),
      insights: readJson(KEY_INSIGHTS, null),
      logs: readJson(KEY_LOGS, {})
    };
  },

  async saveDay(dateKey, dayLog){
    const logs = readJson(KEY_LOGS, {});
    logs[dateKey] = dayLog;
    writeJson(KEY_LOGS, logs);
  },

  async saveSettings(settings){
    writeJson(KEY_SETTINGS, settings);
  },

  async saveRosters(rosters){
    writeJson(KEY_ROSTERS, rosters);
  },

  async saveInsights(insights){
    writeJson(KEY_INSIGHTS, insights);
  },

  async saveMeta(meta){
    writeJson(KEY_META, meta);
  },

  async listSnapshots(){
    const list = readJson(KEY_SNAPSHOTS, []);
    return Array.isArray(list) ? list : [];
  },

  async saveSnapshot(snapshot){
    if(!snapshot || !snapshot.id) return;
    const list = readJson(KEY_SNAPSHOTS, []);
    const next = Array.isArray(list) ? list : [];
    const idx = next.findIndex((item) => item && item.id === snapshot.id);
    if(idx >= 0){
      next[idx] = snapshot;
    }else{
      next.push(snapshot);
    }
    writeJson(KEY_SNAPSHOTS, next);
  },

  async deleteSnapshot(snapshotId){
    if(!snapshotId) return;
    const list = readJson(KEY_SNAPSHOTS, []);
    const next = Array.isArray(list) ? list.filter((item) => item && item.id !== snapshotId) : [];
    writeJson(KEY_SNAPSHOTS, next);
  },

  async restoreSnapshot(snapshotId){
    const list = readJson(KEY_SNAPSHOTS, []);
    const snap = Array.isArray(list) ? list.find((item) => item && item.id === snapshotId) : null;
    if(!snap || !snap.payload){
      throw new Error("Snapshot not found");
    }

    let parsed;
    try{
      parsed = JSON.parse(snap.payload);
    }catch(e){
      throw new Error("Snapshot payload invalid JSON");
    }

    const state = parsed?.state ? parsed.state : parsed;
    writeJson(KEY_META, state?.meta || null);
    writeJson(KEY_SETTINGS, state?.settings || null);
    writeJson(KEY_ROSTERS, state?.rosters || null);
    writeJson(KEY_INSIGHTS, state?.insights || null);
    writeJson(KEY_LOGS, state?.logs || {});
  }
};

export {};
