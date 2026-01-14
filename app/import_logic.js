// @ts-check

import { mergeDay } from "../storage/merge.js";
import { validateImportPayload as validateV4Import } from "../storage/validate.js";

/**
 * Merge logs by day, using mergeDay for collisions.
 * @param {Record<string, any>} baseLogs
 * @param {Record<string, any>} incomingLogs
 * @returns {Record<string, any>}
 */
export function mergeLogs(baseLogs, incomingLogs){
  const out = { ...(baseLogs || {}) };
  if(!incomingLogs || typeof incomingLogs !== "object") return out;

  for(const [dateKey, nextDay] of Object.entries(incomingLogs)){
    if(out[dateKey]){
      out[dateKey] = mergeDay(out[dateKey], nextDay);
    }else{
      out[dateKey] = nextDay;
    }
  }

  return out;
}

/**
 * Validate import payloads, including legacy shapes.
 * @param {any} payload
 * @returns {{ ok: boolean, error?: string, legacy?: boolean, version?: number }}
 */
export function validateImportPayload(payload){
  if(!payload || typeof payload !== "object"){
    return { ok: false, error: "Import failed: payload must be an object." };
  }

  const version = payload.version;
  if(version === 4){
    const result = validateV4Import(payload);
    if(!result.ok){
      return { ok: false, error: result.errors?.[0] || "Import failed: invalid v4 payload.", version: 4 };
    }
    return { ok: true, legacy: false, version: 4 };
  }
  if(version && version !== 3){
    return { ok: false, error: `Unsupported import version ${version}.`, version };
  }

  if(payload.logs && typeof payload.logs !== "object"){
    return { ok: false, error: "Import failed: logs must be an object keyed by date." };
  }

  return {
    ok: true,
    legacy: true,
    version: version || 3
  };
}

export {};
