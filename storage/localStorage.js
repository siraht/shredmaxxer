// @ts-check

// Deprecated shim: prefer ./local.js
import { localAdapter } from "./local.js";

const KEY_META = "shredmaxx_v4_meta";
const KEY_SETTINGS = "shredmaxx_v4_settings";
const KEY_ROSTERS = "shredmaxx_v4_rosters";
const KEY_INSIGHTS = "shredmaxx_v4_insights";
const KEY_LOGS = "shredmaxx_v4_logs";
const KEY_SNAPSHOTS = "shredmaxx_v4_snapshots";

export function isLocalStorageAvailable(){
  try{
    return typeof localStorage !== "undefined";
  }catch{
    return false;
  }
}

// Keep legacy name for compatibility.
export const localStorageAdapter = localAdapter;

export { KEY_META, KEY_SETTINGS, KEY_ROSTERS, KEY_INSIGHTS, KEY_LOGS, KEY_SNAPSHOTS };

export {};
