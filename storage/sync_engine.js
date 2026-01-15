// @ts-check

import { compareHlc } from "../domain/hlc.js";
import { createHlcClock } from "../domain/hlc_clock.js";
import { mergeDay, mergeRosters } from "./merge.js";
import { mergeInsightsState } from "../domain/insights.js";
import { createRemoteClient } from "./remote_client.js";
import { createSyncLeader } from "./sync_leader.js";
import { enqueueOutbox, loadOutbox, removeOutboxOp, updateOutboxOp } from "./outbox.js";
import { savePreSyncSnapshot, saveSyncConflictSnapshot } from "./snapshots.js";
import { storageAdapter } from "./adapter.js";
import { decryptSyncRecord, encryptSyncRecord, normalizeE2eeParams } from "./sync_crypto.js";

const SIGNAL_CHANNEL = "shredmaxx_sync_signal";
const SIGNAL_KEY = "shredmaxx_sync_ping";

function generateId(){
  if(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"){
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isOnline(){
  if(typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

function nowIso(){
  return new Date().toISOString();
}

/**
 * @param {{
 *  getState: () => any,
 *  applyRemoteDay: (dateKey:string, day:any) => Promise<void>,
 *  applyRemoteSettings: (settings:any) => Promise<void>,
 *  applyRemoteRosters: (rosters:any) => Promise<void>,
 *  applyRemoteInsights: (insights:any) => Promise<void>,
 *  applyRemoteMeta: (meta:any) => Promise<void>,
 *  onSyncMeta: (patch:any) => void,
 *  onAudit?: (type:string, message:string, level?:string, detail?:any) => void
 * }} opts
 */
export function createSyncEngine(opts){
  const getState = opts.getState;
  const onSyncMeta = opts.onSyncMeta;
  const onAudit = typeof opts.onAudit === "function" ? opts.onAudit : () => {};
  const applyRemoteDay = opts.applyRemoteDay;
  const applyRemoteSettings = opts.applyRemoteSettings;
  const applyRemoteRosters = opts.applyRemoteRosters;
  const applyRemoteInsights = opts.applyRemoteInsights;
  const applyRemoteMeta = opts.applyRemoteMeta;

  let leader = null;
  let client = null;
  let clock = null;
  let creds = null;
  let e2eePassphrase = "";
  let syncing = false;
  let scheduled = null;
  let backoffMs = 1000;
  let pendingSync = false;
  let signalChannel = null;
  let defaultEndpointUnavailable = false;
  let lastEndpoint = "";
  const onOnline = () => scheduleSync(0);

  function updateSyncMeta(patch){
    if(typeof onSyncMeta === "function") onSyncMeta(patch);
  }

  function getLocalRecord(key){
    const state = getState();
    if(key === "meta") return state.meta || null;
    if(key === "settings") return state.settings || null;
    if(key === "rosters") return state.rosters || null;
    if(key === "insights") return state.insights || null;
    if(key.startsWith("logs/")){
      const dateKey = key.slice(5);
      return state.logs?.[dateKey] || null;
    }
    return null;
  }

  function setLocalRecord(key, value){
    if(key === "meta") return applyRemoteMeta(value);
    if(key === "settings") return applyRemoteSettings(value);
    if(key === "rosters") return applyRemoteRosters(value);
    if(key === "insights") return applyRemoteInsights(value);
    if(key.startsWith("logs/")){
      const dateKey = key.slice(5);
      return applyRemoteDay(dateKey, value);
    }
    return Promise.resolve();
  }

  function ensureClock(){
    if(clock) return clock;
    const actor = getState()?.meta?.installId || "";
    const last = creds?.lastHlc || "";
    clock = createHlcClock(actor, last);
    return clock;
  }

  function stampRecord(record){
    if(!record || typeof record !== "object") return "";
    const hlc = ensureClock().tick();
    record.hlc = hlc;
    record.actor = getState()?.meta?.installId || "";
    creds = { ...(creds || {}), lastHlc: hlc };
    storageAdapter.saveSyncCredentials?.(creds).catch(() => {});
    return hlc;
  }

  function e2eeEnabled(){
    return !!creds?.e2ee?.enabled;
  }

  function requirePassphrase(){
    if(!e2eePassphrase){
      throw new Error("E2EE passphrase required");
    }
  }

  async function maybeEncrypt(key, value){
    if(!e2eeEnabled()) return value;
    requirePassphrase();
    const params = normalizeE2eeParams(creds?.e2ee || {});
    return encryptSyncRecord(value, e2eePassphrase, params, { spaceId: creds.spaceId, key });
  }

  async function maybeDecrypt(key, payload){
    if(!e2eeEnabled()) return payload;
    if(!payload || payload.type !== "shredmaxx:sync_encrypted") return payload;
    requirePassphrase();
    return decryptSyncRecord(payload, e2eePassphrase, { spaceId: creds.spaceId, key });
  }

  async function ensureClient(){
    if(client) return client;
    const settings = getState()?.settings || {};
    const endpoint = settings?.sync?.endpoint || "/api/sync/v1";
    const isDefaultEndpoint = !settings?.sync?.endpoint || settings?.sync?.endpoint === "/api/sync/v1";
    if(endpoint !== lastEndpoint){
      lastEndpoint = endpoint;
      defaultEndpointUnavailable = false;
      client = null;
    }

    if(isDefaultEndpoint && defaultEndpointUnavailable){
      throw new Error("SYNC_UNAVAILABLE_SILENT");
    }

    if(!creds){
      creds = await storageAdapter.getSyncCredentials?.();
    }
    if((!creds || !creds.authToken) && settings?.sync?.mode === "hosted"){
      // If we are on the default endpoint and have no credentials, 
      // we only attempt to create a space if the user hasn't seen a 405/404 before.
      // For now, we try once and if it fails with 404/405 on default endpoint, we go silent.
      const temp = createRemoteClient(endpoint, {});
      const res = await temp.createSpace();
      if(res.ok && res.data && res.data.spaceId && res.data.authToken){
        creds = { ...(creds || {}), spaceId: res.data.spaceId, authToken: res.data.authToken, recordMeta: creds?.recordMeta || {}, lastHlc: creds?.lastHlc || "" };
        await storageAdapter.saveSyncCredentials?.(creds);
        onAudit("sync_space_created", "Sync space created.", "info");
      }else{
        if (isDefaultEndpoint && (res.status === 405 || res.status === 404)) {
          defaultEndpointUnavailable = true;
          throw new Error("SYNC_UNAVAILABLE_SILENT");
        }
        throw new Error("Failed to create sync space");
      }
    }
    if(!creds || !creds.authToken){
      if (isDefaultEndpoint && defaultEndpointUnavailable) throw new Error("SYNC_UNAVAILABLE_SILENT");
      throw new Error("Sync credentials missing");
    }
    client = createRemoteClient(endpoint, creds);
    return client;
  }

  function scheduleSync(delayMs){
    if(scheduled) return;
    const delay = Number.isFinite(delayMs) ? delayMs : 0;
    scheduled = setTimeout(() => {
      scheduled = null;
      syncNow().catch(() => {});
    }, delay);
  }

  function signalSync(){
    if(signalChannel){
      signalChannel.postMessage({ type: "outbox", ts: Date.now() });
    }
    try{
      localStorage.setItem(SIGNAL_KEY, String(Date.now()));
    }catch(e){
      // ignore storage signal failures
    }
  }

  function onSignal(){
    if(leader && leader.isLeader()){
      scheduleSync(0);
    }
  }

  function onSignalMessage(event){
    const data = event?.data || {};
    if(data.type !== "outbox" && data.type !== "sync_now") return;
    onSignal();
  }

  function onSignalStorage(event){
    if(event.key !== SIGNAL_KEY) return;
    onSignal();
  }

  async function enqueueRecord(key, value){
    if(!key || !value) return;
    const settings = getState()?.settings || {};
    if(settings?.sync?.mode !== "hosted") return;
    stampRecord(value);
    const op = {
      id: generateId(),
      key,
      method: "PUT",
      payload: value,
      ts: nowIso(),
      attempts: 0
    };
    const list = await enqueueOutbox(op);
    updateSyncMeta({ pendingOutbox: list.length });
    scheduleSync(settings?.sync?.pushDebounceMs || 1200);
    signalSync();
  }

  async function handleConflict(op, currentEtag){
    const remote = await client.getItem(op.key);
    if(!remote.ok){
      throw new Error(`Conflict fetch failed (${remote.status})`);
    }
    const remoteValue = await maybeDecrypt(op.key, remote.data);
    const localValue = getLocalRecord(op.key);
    let merged = remoteValue;

    if(op.key.startsWith("logs/")){
      merged = mergeDay(localValue, remoteValue, { unionItems: true });
    }else if(op.key === "rosters"){
      merged = mergeRosters(localValue, remoteValue, { dedupeByLabel: true });
    }else if(op.key === "insights"){
      merged = mergeInsightsState(localValue, remoteValue);
    }else if(op.key === "settings"){
      merged = { ...localValue, ...remoteValue };
    }else if(op.key === "meta"){
      merged = { ...localValue, ...remoteValue };
    }

    await saveSyncConflictSnapshot({ state: getState() });
    onAudit("sync_conflict", `Sync conflict on ${op.key}.`, "warn", { key: op.key });

    stampRecord(merged);
    const encrypted = await maybeEncrypt(op.key, merged);
    const res = await client.putItem(op.key, encrypted, remote.etag || currentEtag || "*", generateId());
    if(!res.ok){
      throw new Error(`Conflict retry failed (${res.status})`);
    }
    await setLocalRecord(op.key, merged);
  }

  async function drainOutbox(){
    const list = await loadOutbox();
    updateSyncMeta({ pendingOutbox: list.length });
    if(list.length === 0) return;

    for(const op of list){
      try{
        const meta = creds?.recordMeta || {};
        const existing = meta[op.key] || {};
        const encrypted = await maybeEncrypt(op.key, op.payload);
        const res = await client.putItem(op.key, encrypted, existing.etag || "*", op.id);
        if(res.ok){
          meta[op.key] = { etag: res.etag || existing.etag || "", hlc: op.payload?.hlc || existing.hlc || "" };
          creds = { ...(creds || {}), recordMeta: meta };
          await storageAdapter.saveSyncCredentials?.(creds);
          await removeOutboxOp(op.id);
        }else if(res.status === 412){
          await handleConflict(op, existing.etag);
          await removeOutboxOp(op.id);
          updateSyncMeta({ conflicts: (getState()?.meta?.sync?.conflicts || 0) + 1, lastConflictTs: nowIso() });
        }else{
          throw new Error(`Sync push failed (${res.status})`);
        }
      }catch(e){
        await updateOutboxOp(op.id, (entry) => ({
          ...entry,
          attempts: (entry.attempts || 0) + 1,
          lastError: e?.message || String(e)
        }));
        throw e;
      }
    }

    const remaining = await loadOutbox();
    updateSyncMeta({ pendingOutbox: remaining.length });
  }

  async function pullAndMerge(){
    const index = await client.getIndex();
    if(!index.ok){
      throw new Error(`Sync index failed (${index.status})`);
    }
    const items = Array.isArray(index.data?.items) ? index.data.items : [];
    const meta = creds?.recordMeta || {};

    for(const item of items){
      const key = item?.key;
      if(!key) continue;
      if(key === "meta") continue;
      const local = getLocalRecord(key);
      const localHlc = local?.hlc || meta?.[key]?.hlc || "";
      const remoteHlc = item?.hlc || "";
      if(compareHlc(remoteHlc, localHlc) <= 0) continue;
      const res = await client.getItem(key);
      if(!res.ok) continue;
      const remoteValue = await maybeDecrypt(key, res.data);
      meta[key] = { etag: res.etag || meta?.[key]?.etag || "", hlc: remoteValue?.hlc || remoteHlc || "" };
      await setLocalRecord(key, remoteValue);
    }
    creds = { ...(creds || {}), recordMeta: meta };
    await storageAdapter.saveSyncCredentials?.(creds);
  }

  async function syncNow(){
    if(syncing){
      pendingSync = true;
      return;
    }
    if(leader && !leader.isLeader()){
      return;
    }

    const settings = getState()?.settings || {};
    if(settings?.sync?.mode !== "hosted"){
      updateSyncMeta({ status: "idle" });
      return;
    }

    syncing = true;
    pendingSync = false;
    try{
      if(!isOnline()){
        updateSyncMeta({ status: "offline" });
        return;
      }
      await ensureClient();
      updateSyncMeta({ status: "syncing" });
      await savePreSyncSnapshot({ state: getState() });
      await pullAndMerge();
      await drainOutbox();
      updateSyncMeta({ status: "idle", lastSyncTs: nowIso(), lastError: "" });
      backoffMs = 1000;
    }catch(e){
      if (e.message === "SYNC_UNAVAILABLE_SILENT") {
        updateSyncMeta({ status: "idle", lastError: "" });
        // No backoff retry for silent failures
        syncing = false;
        return;
      }
      updateSyncMeta({ status: isOnline() ? "error" : "offline", lastError: e?.message || String(e) });
      backoffMs = Math.min(backoffMs * 2, 60000);
      scheduleSync(backoffMs + Math.floor(Math.random() * 500));
    }finally{
      syncing = false;
      if(pendingSync){
        scheduleSync(0);
      }
    }
  }

  function start(){
    const settings = getState()?.settings || {};
    if(settings?.sync?.mode !== "hosted") return;
    leader = createSyncLeader({
      onLeaderChange: (isLeader) => {
        if(isLeader && settings?.sync?.pullOnBoot){
          syncNow().catch(() => {});
        }
      }
    });
    leader.start();
    loadOutbox()
      .then((list) => updateSyncMeta({ pendingOutbox: Array.isArray(list) ? list.length : 0 }))
      .catch(() => {});
    if(typeof BroadcastChannel !== "undefined"){
      signalChannel = new BroadcastChannel(SIGNAL_CHANNEL);
      signalChannel.addEventListener("message", onSignalMessage);
    }
    if(typeof window !== "undefined"){
      window.addEventListener("online", onOnline);
      window.addEventListener("storage", onSignalStorage);
    }
  }

  function stop(){
    if(leader) leader.stop();
    leader = null;
    if(scheduled){
      clearTimeout(scheduled);
      scheduled = null;
    }
    if(signalChannel){
      signalChannel.removeEventListener("message", onSignalMessage);
      signalChannel.close();
      signalChannel = null;
    }
    if(typeof window !== "undefined"){
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onSignalStorage);
    }
  }

  return {
    start,
    stop,
    syncNow,
    enqueueRecord,
    stampRecord,
    setE2eePassphrase: (passphrase) => {
      e2eePassphrase = typeof passphrase === "string" ? passphrase : "";
    },
    clearE2eePassphrase: () => {
      e2eePassphrase = "";
    }
  };
}

export {};
