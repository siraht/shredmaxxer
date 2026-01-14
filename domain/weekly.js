// @ts-check

import { addDaysLocal, dateToKey } from "./time.js";

/**
 * @typedef {import("./schema.js").DayLog} DayLog
 */

/**
 * Get the local week start date for an anchor date.
 * @param {Date} anchor
 * @param {number} weekStart 0=Sunday, 1=Monday, ...
 * @returns {Date}
 */
export function getWeekStartDate(anchor, weekStart){
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12, 0, 0, 0);
  const day = start.getDay();
  const offset = (day - weekStart + 7) % 7;
  return addDaysLocal(start, -offset);
}

/**
 * Get the 7 DateKeys in the week containing the anchor date.
 * @param {Date} anchor
 * @param {number} weekStart 0=Sunday, 1=Monday, ...
 * @returns {string[]}
 */
export function getWeekDateKeys(anchor, weekStart){
  const start = getWeekStartDate(anchor, weekStart);
  const keys = [];
  for(let i = 0; i < 7; i++){
    keys.push(dateToKey(addDaysLocal(start, i)));
  }
  return keys;
}

/**
 * Collect unique item sets for the week.
 * @param {Record<string, DayLog>} logs
 * @param {string[]} dateKeys
 */
export function collectWeeklySets(logs, dateKeys){
  const sets = {
    proteins: new Set(),
    carbs: new Set(),
    fats: new Set(),
    micros: new Set()
  };

  const list = Array.isArray(dateKeys) ? dateKeys : [];
  for(const key of list){
    const day = logs?.[key];
    if(!day || typeof day !== "object") continue;
    const segments = day.segments || {};
    for(const seg of Object.values(segments)){
      if(!seg || typeof seg !== "object") continue;
      for(const category of ["proteins", "carbs", "fats", "micros"]){
        const items = Array.isArray(seg[category]) ? seg[category] : [];
        items.forEach((item) => sets[category].add(item));
      }
    }
  }

  return sets;
}

/**
 * Compute weekly unique counts for P/C/F/μ.
 * @param {Record<string, DayLog>} logs
 * @param {string[]} dateKeys
 */
export function computeWeeklyUniqueCounts(logs, dateKeys){
  const sets = collectWeeklySets(logs, dateKeys);
  return {
    proteins: sets.proteins.size,
    carbs: sets.carbs.size,
    fats: sets.fats.size,
    micros: sets.micros.size,
    sets
  };
}

/**
 * Summarize FTN modes for the week.
 * @param {Record<string, DayLog>} logs
 * @param {string[]} dateKeys
 */
export function summarizeFtnModes(logs, dateKeys){
  const summary = { strict: 0, lite: 0, off: 0, unset: 0, days: 0, loggedDays: 0 };
  const list = Array.isArray(dateKeys) ? dateKeys : [];
  summary.days = list.length;

  for(const key of list){
    const day = logs?.[key];
    if(!day || typeof day !== "object") continue;
    summary.loggedDays += 1;
    const ftn = day.segments?.ftn;
    const mode = ftn?.ftnMode || "";
    if(mode === "strict") summary.strict += 1;
    else if(mode === "lite") summary.lite += 1;
    else if(mode === "off") summary.off += 1;
    else summary.unset += 1;
  }

  return summary;
}

/**
 * Compute segment coverage counts using status values.
 * Missing days/segments are treated as unlogged.
 * @param {Record<string, DayLog>} logs
 * @param {string[]} dateKeys
 */
export function computeSegmentCoverage(logs, dateKeys){
  const list = Array.isArray(dateKeys) ? dateKeys : [];
  const ids = ["ftn", "lunch", "dinner", "late"];
  const initCounts = () => ({ logged: 0, none: 0, unlogged: 0 });
  const coverage = {
    ftn: initCounts(),
    lunch: initCounts(),
    dinner: initCounts(),
    late: initCounts()
  };

  for(const key of list){
    const day = logs?.[key];
    for(const id of ids){
      const status = day?.segments?.[id]?.status || "unlogged";
      if(status === "logged"){
        coverage[id].logged += 1;
      }else if(status === "none"){
        coverage[id].none += 1;
      }else{
        coverage[id].unlogged += 1;
      }
    }
  }

  return coverage;
}

/**
 * Provide a phase-aware guidance label (display only).
 * @param {""|"strict"|"maintenance"|"advanced"} phase
 */
export function getPhaseTargetLabel(phase){
  if(phase === "strict") return "Strict phase: prioritize FTN strict most days.";
  if(phase === "maintenance") return "Maintenance: balance strict and lite FTN days.";
  if(phase === "advanced") return "Advanced: flexible FTN modes; stay consistent.";
  return "";
}

/**
 * Compute weekly summary inputs for Review.
 * @param {{
 *  logs: Record<string, DayLog>,
 *  anchorDate: Date,
 *  weekStart?: number,
 *  phase?: ""|"strict"|"maintenance"|"advanced"
 * }} params
 */
export function computeWeeklySummary(params){
  const anchorDate = params.anchorDate instanceof Date ? params.anchorDate : new Date();
  const weekStart = Number.isFinite(params.weekStart) ? params.weekStart : 0;
  const dateKeys = getWeekDateKeys(anchorDate, weekStart);
  const uniqueCounts = computeWeeklyUniqueCounts(params.logs || {}, dateKeys);
  const ftnSummary = summarizeFtnModes(params.logs || {}, dateKeys);
  const coverage = computeSegmentCoverage(params.logs || {}, dateKeys);
  const phaseLabel = getPhaseTargetLabel(params.phase || "");
  return {
    dateKeys,
    uniqueCounts,
    ftnSummary,
    coverage,
    phaseLabel
  };
}

export {};
