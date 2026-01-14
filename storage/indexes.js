// @ts-check

import { computeDayCoverage } from "../domain/coverage.js";
import { computeWeeklySummary, getWeekDateKeys, getWeekStartDate } from "../domain/weekly.js";
import { dateToKey } from "../domain/time.js";
import { compareHlc } from "../domain/hlc.js";
import { storageAdapter } from "./adapter.js";

export const INDEX_VERSION = 1;

/**
 * @param {string} dateKey
 * @returns {Date}
 */
function dateFromKey(dateKey){
  const [y, m, d] = String(dateKey || "").split("-").map((v) => Number(v));
  if(!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)){
    return new Date();
  }
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * @param {string[]} dateKeys
 * @param {any} logs
 * @returns {{ sourceRev:number, sourceHlc:string }}
 */
function computeWeekSignature(dateKeys, logs){
  let sourceRev = 0;
  let sourceHlc = "";
  for(const dateKey of dateKeys){
    const day = logs?.[dateKey];
    if(!day || typeof day !== "object") continue;
    if(Number.isFinite(day.rev)) sourceRev += day.rev;
    const hlc = typeof day.hlc === "string" ? day.hlc : "";
    if(hlc && (!sourceHlc || compareHlc(hlc, sourceHlc) > 0)){
      sourceHlc = hlc;
    }
  }
  return { sourceRev, sourceHlc };
}

/**
 * @param {string} dateKey
 * @param {number} weekStart
 * @returns {string}
 */
export function getWeekKey(dateKey, weekStart){
  const anchor = dateFromKey(dateKey);
  const start = getWeekStartDate(anchor, weekStart);
  return dateToKey(start);
}

/**
 * @param {{ dateKey: string, day: any, rosters: any }} params
 */
export function buildDayIndexEntry(params){
  const { dateKey, day, rosters } = params;
  const coverage = computeDayCoverage(day || {}, rosters || {});
  return {
    dateKey,
    indexVersion: INDEX_VERSION,
    counts: coverage.counts,
    flags: coverage.flags,
    signals: {
      energy: day?.energy || "",
      mood: day?.mood || "",
      cravings: day?.cravings || ""
    },
    ftnMode: day?.segments?.ftn?.ftnMode || "",
    lastEdited: day?.tsLast || "",
    sourceRev: Number.isFinite(day?.rev) ? day.rev : 0,
    sourceHlc: day?.hlc || ""
  };
}

/**
 * @param {{ weekKey: string, dateKeys: string[], logs: any, rosters: any, weekStart?: number, phase?: string }} params
 */
export function buildWeekIndexEntry(params){
  const { weekKey, dateKeys, logs, rosters } = params;
  const weekStart = Number.isFinite(params.weekStart) ? params.weekStart : 0;
  const anchorDate = dateFromKey(weekKey);
  const summary = computeWeeklySummary({
    logs: logs || {},
    rosters: rosters || {},
    anchorDate,
    weekStart,
    phase: params.phase || ""
  });
  const keys = Array.isArray(summary.dateKeys) && summary.dateKeys.length ? summary.dateKeys : (Array.isArray(dateKeys) ? dateKeys : []);
  const signature = computeWeekSignature(keys, logs);

  return {
    weekKey,
    weekStart,
    indexVersion: INDEX_VERSION,
    dateKeys: keys,
    uniqueCounts: summary.uniqueCounts,
    ftnSummary: summary.ftnSummary,
    coverage: summary.coverage,
    matrix: summary.matrix,
    issueFrequency: summary.issueFrequency,
    correlations: summary.correlations,
    phaseLabel: summary.phaseLabel,
    sourceRev: signature.sourceRev,
    sourceHlc: signature.sourceHlc
  };
}

/**
 * @param {any} entry
 * @param {any} day
 * @returns {boolean}
 */
export function isDayIndexStale(entry, day){
  if(!entry || typeof entry !== "object") return true;
  if(entry.indexVersion !== INDEX_VERSION) return true;
  const sourceRev = Number.isFinite(day?.rev) ? day.rev : 0;
  const sourceHlc = typeof day?.hlc === "string" ? day.hlc : "";
  return entry.sourceRev !== sourceRev || entry.sourceHlc !== sourceHlc;
}

/**
 * @param {any} entry
 * @param {string[]} dateKeys
 * @param {any} logs
 * @returns {boolean}
 */
export function isWeekIndexStale(entry, dateKeys, logs){
  if(!entry || typeof entry !== "object") return true;
  if(entry.indexVersion !== INDEX_VERSION) return true;
  const list = Array.isArray(dateKeys) ? dateKeys : [];
  const stored = Array.isArray(entry.dateKeys) ? entry.dateKeys : [];
  if(stored.length !== list.length) return true;
  for(let i = 0; i < list.length; i++){
    if(stored[i] !== list[i]) return true;
  }
  const signature = computeWeekSignature(list, logs);
  return entry.sourceRev !== signature.sourceRev || entry.sourceHlc !== signature.sourceHlc;
}

/**
 * Update indexes for a single day and its week.
 * @param {{ state: any, dateKey: string, adapter?: any }} params
 */
export async function updateIndexesForDay(params){
  const { state, dateKey } = params;
  const adapter = params.adapter || storageAdapter;
  const day = state?.logs?.[dateKey];
  if(!day || !adapter?.saveDayIndex || !adapter?.saveWeekIndex) return;

  const dayEntry = buildDayIndexEntry({ dateKey, day, rosters: state.rosters });
  if(state){
    if(!state.dayIndex || typeof state.dayIndex !== "object") state.dayIndex = {};
    state.dayIndex[dateKey] = dayEntry;
  }
  await adapter.saveDayIndex(dateKey, dayEntry);

  const weekStart = Number.isFinite(state?.settings?.weekStart) ? state.settings.weekStart : 0;
  const weekKey = getWeekKey(dateKey, weekStart);
  const anchor = dateFromKey(dateKey);
  const dateKeys = getWeekDateKeys(anchor, weekStart);
  const weekEntry = buildWeekIndexEntry({
    weekKey,
    dateKeys,
    logs: state.logs || {},
    rosters: state.rosters,
    weekStart,
    phase: state?.settings?.phase || ""
  });
  if(state){
    if(!state.weekIndex || typeof state.weekIndex !== "object") state.weekIndex = {};
    state.weekIndex[weekKey] = weekEntry;
  }
  await adapter.saveWeekIndex(weekKey, weekEntry);
}

/**
 * Rebuild all derived indexes.
 * @param {any} state
 * @param {any} [adapter]
 */
export async function rebuildIndexes(state, adapter){
  const store = adapter || storageAdapter;
  if(!store?.saveDayIndex || !store?.saveWeekIndex) return;

  if(typeof store.clearDayIndex === "function"){
    await store.clearDayIndex();
  }
  if(typeof store.clearWeekIndex === "function"){
    await store.clearWeekIndex();
  }

  const logs = state?.logs || {};
  const rosters = state?.rosters || {};
  if(state){
    state.dayIndex = {};
    state.weekIndex = {};
  }
  const weekStart = Number.isFinite(state?.settings?.weekStart) ? state.settings.weekStart : 0;

  const weekKeys = new Set();
  for(const [dateKey, day] of Object.entries(logs)){
    const entry = buildDayIndexEntry({ dateKey, day, rosters });
    if(state && state.dayIndex){
      state.dayIndex[dateKey] = entry;
    }
    await store.saveDayIndex(dateKey, entry);
    weekKeys.add(getWeekKey(dateKey, weekStart));
  }

  for(const weekKey of weekKeys){
    const start = dateFromKey(weekKey);
    const dateKeys = getWeekDateKeys(start, weekStart);
    const weekEntry = buildWeekIndexEntry({
      weekKey,
      dateKeys,
      logs,
      rosters,
      weekStart,
      phase: state?.settings?.phase || ""
    });
    if(state && state.weekIndex){
      state.weekIndex[weekKey] = weekEntry;
    }
    await store.saveWeekIndex(weekKey, weekEntry);
  }
}

export {};
