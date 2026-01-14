// @ts-check

import { computeDayCoverage } from "./coverage.js";
import { computeWeeklySummary, getWeekStartDate, getWeekDateKeys } from "./weekly.js";
import { dateToKey } from "./time.js";
import { maxHlc } from "./hlc.js";

export const INDEX_VERSION = 1;

/**
 * @param {string} dateKey
 * @returns {Date}
 */
export function parseDateKey(dateKey){
  return new Date(`${dateKey}T12:00:00`);
}

/**
 * @param {string} dateKey
 * @param {number} weekStart
 * @returns {string}
 */
export function getWeekKeyFromDateKey(dateKey, weekStart){
  const anchor = parseDateKey(dateKey);
  const start = getWeekStartDate(anchor, weekStart);
  return dateToKey(start);
}

/**
 * @param {any} day
 * @returns {{ rev:number, hlc:string, lastEdited:string }}
 */
export function getDaySourceSignature(day){
  const rev = Number.isFinite(day?.rev) ? day.rev : 0;
  const hlc = typeof day?.hlc === "string" ? day.hlc : "";
  const lastEdited = typeof day?.tsLast === "string"
    ? day.tsLast
    : (typeof day?.tsCreated === "string" ? day.tsCreated : "");
  return { rev, hlc, lastEdited };
}

/**
 * @param {string[]} dateKeys
 * @param {Record<string, any>} logs
 * @returns {{ rev:number, hlc:string, lastEdited:string }}
 */
export function computeWeekSourceSignature(dateKeys, logs){
  let sumRev = 0;
  let maxHlcValue = "";
  let lastEdited = "";
  const list = Array.isArray(dateKeys) ? dateKeys : [];
  for(const key of list){
    const day = logs?.[key];
    if(!day) continue;
    const sig = getDaySourceSignature(day);
    sumRev += sig.rev;
    maxHlcValue = maxHlc(maxHlcValue, sig.hlc);
    if(sig.lastEdited && sig.lastEdited.localeCompare(lastEdited) > 0){
      lastEdited = sig.lastEdited;
    }
  }
  return { rev: sumRev, hlc: maxHlcValue, lastEdited };
}

/**
 * @param {string} dateKey
 * @param {any} day
 * @param {any} rosters
 */
export function buildDayIndexEntry(dateKey, day, rosters){
  const coverage = computeDayCoverage(day || {}, rosters || {});
  const sig = getDaySourceSignature(day || {});
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
    lastEdited: sig.lastEdited,
    sourceRev: sig.rev,
    sourceHlc: sig.hlc
  };
}

/**
 * @param {{
 *  anchorDate: Date,
 *  logs: Record<string, any>,
 *  rosters: any,
 *  weekStart?: number,
 *  phase?: string
 * }} params
 */
export function buildWeekIndexEntry(params){
  const anchor = params.anchorDate instanceof Date ? params.anchorDate : new Date();
  const weekStart = Number.isFinite(params.weekStart) ? params.weekStart : 0;
  const summary = computeWeeklySummary({
    logs: params.logs || {},
    rosters: params.rosters || {},
    anchorDate: anchor,
    weekStart,
    phase: params.phase || ""
  });
  const dateKeys = summary.dateKeys || getWeekDateKeys(anchor, weekStart);
  const weekKey = dateKeys[0] || dateToKey(anchor);
  const sig = computeWeekSourceSignature(dateKeys, params.logs || {});
  return {
    weekKey,
    weekStart,
    indexVersion: INDEX_VERSION,
    dateKeys,
    uniqueCounts: summary.uniqueCounts,
    ftnSummary: summary.ftnSummary,
    coverage: summary.coverage,
    matrix: summary.matrix,
    issueFrequency: summary.issueFrequency,
    correlations: summary.correlations,
    phaseLabel: summary.phaseLabel,
    lastEdited: sig.lastEdited,
    sourceRev: sig.rev,
    sourceHlc: sig.hlc
  };
}

/**
 * @param {any} entry
 * @param {any} day
 * @returns {boolean}
 */
export function isDayIndexFresh(entry, day){
  if(!entry || !day) return false;
  if(entry.indexVersion !== INDEX_VERSION) return false;
  const sig = getDaySourceSignature(day);
  const entryHlc = typeof entry.sourceHlc === "string" ? entry.sourceHlc : "";
  return entry.sourceRev === sig.rev && entryHlc === sig.hlc;
}

/**
 * @param {any} entry
 * @param {Record<string, any>} logs
 * @returns {boolean}
 */
export function isWeekIndexFresh(entry, logs){
  if(!entry) return false;
  if(entry.indexVersion !== INDEX_VERSION) return false;
  const dateKeys = Array.isArray(entry.dateKeys) ? entry.dateKeys : [];
  const sig = computeWeekSourceSignature(dateKeys, logs || {});
  const entryHlc = typeof entry.sourceHlc === "string" ? entry.sourceHlc : "";
  return entry.sourceRev === sig.rev && entryHlc === sig.hlc;
}

export {};
