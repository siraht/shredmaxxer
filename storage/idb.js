// @ts-check

const DB_NAME = "shredmaxx_solar_log";
const DB_VERSION = 3;

const STORES = {
  meta: "meta",
  settings: "settings",
  rosters: "rosters",
  insights: "insights",
  logs: "logs",
  snapshots: "snapshots",
  outbox: "outbox",
  dayIndex: "day_index",
  weekIndex: "week_index",
  auditLog: "audit_log",
  syncCredentials: "sync_credentials"
};

let openPromise = null;

export function isIndexedDbAvailable(){
  return typeof indexedDB !== "undefined";
}

function requestToPromise(request){
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function openDatabase(){
  if(openPromise) return openPromise;
  if(!isIndexedDbAvailable()){
    return Promise.reject(new Error("IndexedDB not available"));
  }

  openPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for(const name of Object.values(STORES)){
        if(!db.objectStoreNames.contains(name)){
          if(name === STORES.snapshots){
            db.createObjectStore(name, { keyPath: "id" });
          }else{
            db.createObjectStore(name);
          }
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        openPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      openPromise = null;
      reject(req.error || new Error("Failed to open IndexedDB"));
    };
    req.onblocked = () => {
      openPromise = null;
      reject(new Error("IndexedDB open blocked"));
    };
  });

  return openPromise;
}

function withStore(db, storeName, mode, fn){
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  return new Promise((resolve, reject) => {
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

function getSingleton(db, storeName, key){
  return withStore(db, storeName, "readonly", (store) => requestToPromise(store.get(key)));
}

function setSingleton(db, storeName, key, value){
  return withStore(db, storeName, "readwrite", (store) => requestToPromise(store.put(value, key)));
}

async function getAllByKey(db, storeName){
  return withStore(db, storeName, "readonly", async (store) => {
    const values = await requestToPromise(store.getAll());
    const keys = await requestToPromise(store.getAllKeys());
    /** @type {Record<string, any>} */
    const out = {};
    for(let i = 0; i < keys.length; i++){
      out[String(keys[i])] = values[i];
    }
    return out;
  });
}

async function clearStore(db, storeName){
  return withStore(db, storeName, "readwrite", (store) => requestToPromise(store.clear()));
}

/**
 * IndexedDB StorageAdapter implementation.
 */
export const idbAdapter = {
  async loadState(){
    const db = await openDatabase();
    const meta = await getSingleton(db, STORES.meta, "meta");
    const settings = await getSingleton(db, STORES.settings, "settings");
    const rosters = await getSingleton(db, STORES.rosters, "rosters");
    const insights = await getSingleton(db, STORES.insights, "insights");
    const logs = await getAllByKey(db, STORES.logs);
    return { meta, settings, rosters, insights, logs };
  },

  async saveDay(dateKey, dayLog){
    const db = await openDatabase();
    await setSingleton(db, STORES.logs, dateKey, dayLog);
  },

  async saveSettings(settings){
    const db = await openDatabase();
    await setSingleton(db, STORES.settings, "settings", settings);
  },

  async saveRosters(rosters){
    const db = await openDatabase();
    await setSingleton(db, STORES.rosters, "rosters", rosters);
  },

  async saveInsights(insights){
    const db = await openDatabase();
    await setSingleton(db, STORES.insights, "insights", insights);
  },

  async saveMeta(meta){
    const db = await openDatabase();
    await setSingleton(db, STORES.meta, "meta", meta);
  },

  async getDayIndex(dateKey){
    const db = await openDatabase();
    return getSingleton(db, STORES.dayIndex, dateKey);
  },

  async saveDayIndex(dateKey, entry){
    const db = await openDatabase();
    await setSingleton(db, STORES.dayIndex, dateKey, entry);
  },

  async listDayIndex(){
    const db = await openDatabase();
    return getAllByKey(db, STORES.dayIndex);
  },

  async clearDayIndex(){
    const db = await openDatabase();
    await clearStore(db, STORES.dayIndex);
  },

  async getWeekIndex(weekKey){
    const db = await openDatabase();
    return getSingleton(db, STORES.weekIndex, weekKey);
  },

  async saveWeekIndex(weekKey, entry){
    const db = await openDatabase();
    await setSingleton(db, STORES.weekIndex, weekKey, entry);
  },

  async listWeekIndex(){
    const db = await openDatabase();
    return getAllByKey(db, STORES.weekIndex);
  },

  async clearWeekIndex(){
    const db = await openDatabase();
    await clearStore(db, STORES.weekIndex);
  },

  async getAuditLog(){
    const db = await openDatabase();
    const log = await getSingleton(db, STORES.auditLog, "audit_log");
    return Array.isArray(log) ? log : [];
  },

  async saveAuditLog(log){
    const db = await openDatabase();
    const list = Array.isArray(log) ? log : [];
    await setSingleton(db, STORES.auditLog, "audit_log", list);
  },

  async getOutbox(){
    const db = await openDatabase();
    const list = await getSingleton(db, STORES.outbox, "outbox");
    return Array.isArray(list) ? list : [];
  },

  async saveOutbox(list){
    const db = await openDatabase();
    const next = Array.isArray(list) ? list : [];
    await setSingleton(db, STORES.outbox, "outbox", next);
  },

  async getSyncCredentials(){
    const db = await openDatabase();
    return getSingleton(db, STORES.syncCredentials, "sync_credentials");
  },

  async saveSyncCredentials(creds){
    const db = await openDatabase();
    await setSingleton(db, STORES.syncCredentials, "sync_credentials", creds || null);
  },

  async listSnapshots(){
    const db = await openDatabase();
    const all = await withStore(db, STORES.snapshots, "readonly", (store) => requestToPromise(store.getAll()));
    return Array.isArray(all) ? all : [];
  },

  async saveSnapshot(snapshot){
    const db = await openDatabase();
    if(!snapshot || !snapshot.id){
      throw new Error("Snapshot must include an id");
    }
    await withStore(db, STORES.snapshots, "readwrite", (store) => {
      if(store.keyPath){
        return requestToPromise(store.put(snapshot));
      }
      return requestToPromise(store.put(snapshot, snapshot.id));
    });
  },

  async deleteSnapshot(snapshotId){
    const db = await openDatabase();
    if(!snapshotId) return;
    await withStore(db, STORES.snapshots, "readwrite", (store) => requestToPromise(store.delete(snapshotId)));
  },

  async restoreSnapshot(snapshotId){
    const db = await openDatabase();
    const snap = await getSingleton(db, STORES.snapshots, snapshotId);
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
    const has = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key);
    const meta = has(state, "meta") ? state.meta : null;
    const settings = has(state, "settings") ? state.settings : null;
    const rosters = has(state, "rosters") ? state.rosters : null;
    const logs = has(state, "logs") && state.logs ? state.logs : {};

    const tx = db.transaction([STORES.meta, STORES.settings, STORES.rosters, STORES.insights, STORES.logs], "readwrite");
    tx.objectStore(STORES.meta).put(meta, "meta");
    tx.objectStore(STORES.settings).put(settings, "settings");
    tx.objectStore(STORES.rosters).put(rosters, "rosters");
    tx.objectStore(STORES.insights).put(has(state, "insights") ? state.insights : null, "insights");
    tx.objectStore(STORES.logs).clear();
    for(const [k, v] of Object.entries(logs)){
      tx.objectStore(STORES.logs).put(v, k);
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Snapshot restore failed"));
      tx.onabort = () => reject(tx.error || new Error("Snapshot restore aborted"));
    });
  }
};

export { openDatabase, STORES };
