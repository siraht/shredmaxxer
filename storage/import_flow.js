// @ts-check

import { parseImportText } from "./import.js";
import { mergeDay, mergeRosters } from "./merge.js";
import { savePreImportSnapshot } from "./snapshots.js";
import { validateImportPayload } from "./validate.js";
import { createInsightsState, mergeInsightsState } from "../domain/insights.js";

/**
 * @typedef {Object} ImportApplyResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {any} [nextState]
 * @property {any} [snapshot]
 * @property {boolean} [legacy]
 * @property {number} [version]
 */

/**
 * Strip non-state keys from an import payload.
 * @param {any} payload
 * @returns {{version:number, meta:any, settings:any, rosters:any, logs:any}}
 */
export function sanitizeImportPayload(payload){
  return {
    version: payload.version,
    meta: payload.meta,
    settings: payload.settings,
    rosters: payload.rosters,
    insights: payload.insights,
    logs: payload.logs
  };
}

/**
 * Merge logs by DateKey using mergeDay resolution.
 * @param {Record<string, any>} baseLogs
 * @param {Record<string, any>} incomingLogs
 * @param {object} [options]
 * @returns {Record<string, any>}
 */
export function mergeLogs(baseLogs, incomingLogs, options = {}){
  const out = { ...(baseLogs || {}) };
  if(!incomingLogs || typeof incomingLogs !== "object") return out;

  for(const [dateKey, nextDay] of Object.entries(incomingLogs)){
    if(out[dateKey]){
      out[dateKey] = mergeDay(out[dateKey], nextDay, options);
    }else{
      out[dateKey] = nextDay;
    }
  }

  return out;
}

/**
 * Merge two v4 states with conservative defaults.
 * By default, settings/meta from the current state are preserved.
 * @param {any} currentState
 * @param {any} incomingState
 * @param {{unionItems?:boolean, dedupeByLabel?:boolean, overrideSettings?:boolean, overrideMeta?:boolean}} [options]
 * @returns {any}
 */
export function mergeStates(currentState, incomingState, options = {}){
  const base = currentState || {};
  const inc = incomingState || {};

  const merged = {
    ...base,
    rosters: mergeRosters(base.rosters, inc.rosters, options),
    logs: mergeLogs(base.logs, inc.logs, options),
    insights: mergeInsightsState(
      base.insights || createInsightsState(),
      inc.insights || createInsightsState()
    )
  };

  if(!base.version && inc.version){
    merged.version = inc.version;
  }

  if(!base.settings && inc.settings){
    merged.settings = inc.settings;
  }

  if(!base.meta && inc.meta){
    merged.meta = inc.meta;
  }

  if(options.overrideSettings){
    merged.settings = inc.settings || base.settings;
  }

  if(options.overrideMeta){
    merged.meta = inc.meta || base.meta;
  }

  return merged;
}

/**
 * Apply an import payload to the current state.
 * - validates JSON text if provided
 * - creates a pre-import snapshot via adapter
 * - merge (default) or replace
 * @param {{
 *  currentState:any,
 *  importText?:string,
 *  payload?:any,
 *  mode?:"merge"|"replace",
 *  options?:{unionItems?:boolean, dedupeByLabel?:boolean, overrideSettings?:boolean, overrideMeta?:boolean},
 *  adapter?:any,
 *  snapshotMax?:number
 * }} opts
 * @returns {Promise<ImportApplyResult>}
 */
export async function applyImport(opts){
  const mode = opts.mode || "merge";
  const options = opts.options || {};

  let payload = opts.payload;
  if(!payload && typeof opts.importText === "string"){
    const parsed = parseImportText(opts.importText);
    if(!parsed.ok){
      return { ok: false, errors: parsed.errors };
    }
    payload = parsed.payload;
  }

  if(!payload || typeof payload !== "object"){
    return { ok: false, errors: ["Import payload missing or invalid."] };
  }

  const validation = validateImportPayload(payload);
  if(!validation.ok){
    return {
      ok: false,
      errors: validation.errors,
      legacy: validation.legacy,
      version: validation.version
    };
  }

  const currentState = opts.currentState || {};
  const incomingState = sanitizeImportPayload(payload);
  const snapshot = await savePreImportSnapshot({
    state: currentState,
    adapter: opts.adapter,
    max: opts.snapshotMax
  });

  if(mode === "replace"){
    return { ok: true, errors: [], nextState: incomingState, snapshot };
  }

  const nextState = mergeStates(currentState, incomingState, options);
  return { ok: true, errors: [], nextState, snapshot };
}

export default {
  mergeLogs,
  mergeStates,
  applyImport
};
