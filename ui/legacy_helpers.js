// @ts-check

import { effectiveSegmentFlags } from "../domain/heuristics.js";

/**
 * @param {any} seg
 * @returns {{P:number, C:number, F:number, M:number}}
 */
export function segCounts(seg){
  if(!seg || typeof seg !== "object"){
    return { P: 0, C: 0, F: 0, M: 0 };
  }
  const proteins = Array.isArray(seg.proteins) ? seg.proteins.length : 0;
  const carbs = Array.isArray(seg.carbs) ? seg.carbs.length : 0;
  const fats = Array.isArray(seg.fats) ? seg.fats.length : 0;
  const micros = Array.isArray(seg.micros) ? seg.micros.length : 0;
  return {
    P: proteins,
    C: carbs,
    F: fats,
    M: micros
  };
}

/**
 * @param {any} seg
 * @param {string} segId
 * @returns {boolean}
 */
export function segmentHasContent(seg, segId){
  if(!seg) return false;
  const hasItems = (Array.isArray(seg.proteins) ? seg.proteins.length : 0)
    || (Array.isArray(seg.carbs) ? seg.carbs.length : 0)
    || (Array.isArray(seg.fats) ? seg.fats.length : 0)
    || (Array.isArray(seg.micros) ? seg.micros.length : 0);
  const hasFlags = (seg.collision && seg.collision !== "auto") || (seg.highFatMeal && seg.highFatMeal !== "auto") || seg.seedOil || seg.notes;
  const hasFtn = segId === "ftn" && seg.ftnMode;
  return !!(hasItems || hasFlags || hasFtn);
}

/**
 * @param {any} day
 * @returns {boolean}
 */
export function dayHasDailyContent(day){
  if(!day) return false;
  return !!(day.movedBeforeLunch || day.trained || day.highFatDay || day.energy || day.mood || day.cravings || day.notes);
}

/**
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
export function formatLatLon(lat, lon){
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

/**
 * @param {string} input
 * @returns {{ segments: string[], includeDaily: boolean }}
 */
export function parseCopySegments(input){
  const raw = String(input || "").trim().toLowerCase();
  if(!raw) return { segments: [], includeDaily: false };
  if(raw === "all" || raw === "day"){
    return { segments: ["ftn", "lunch", "dinner", "late"], includeDaily: true };
  }
  const map = {
    ftn: "ftn",
    lunch: "lunch",
    dinner: "dinner",
    late: "late"
  };
  const parts = raw.split(/[, ]+/).map(p => p.trim()).filter(Boolean);
  const segments = [];
  for(const part of parts){
    const id = map[part];
    if(id && !segments.includes(id)) segments.push(id);
  }
  return { segments, includeDaily: false };
}

/**
 * @param {any} day
 * @returns {{ proteins:number, carbs:number, fats:number, micros:number }}
 */
export function mergeDayDiversity(day){
  const out = { proteins: 0, carbs: 0, fats: 0, micros: 0 };
  if(!day || typeof day !== "object") return out;
  const sets = { proteins: new Set(), carbs: new Set(), fats: new Set(), micros: new Set() };
  for(const seg of Object.values(day.segments || {})){
    if(!seg || typeof seg !== "object") continue;
    for(const k of ["proteins", "carbs", "fats", "micros"]){
      const list = Array.isArray(seg[k]) ? seg[k] : [];
      list.forEach(x => sets[k].add(x));
    }
  }
  out.proteins = sets.proteins.size;
  out.carbs = sets.carbs.size;
  out.fats = sets.fats.size;
  out.micros = sets.micros.size;
  return out;
}

/**
 * @param {any} day
 * @param {any} rosters
 * @returns {{ collision: boolean, seedOil: boolean, highFat: boolean }}
 */
export function countIssues(day, rosters){
  if(!day || typeof day !== "object"){
    return { collision: false, seedOil: false, highFat: false };
  }
  let collision = false;
  let seedOil = false;
  let highFat = false;
  for(const seg of Object.values(day.segments || {})){
    if(!seg || typeof seg !== "object") continue;
    const effective = effectiveSegmentFlags(seg, rosters);
    if(effective.collision.value) collision = true;
    if(seg.seedOil === "yes") seedOil = true;
    if(effective.highFatMeal.value) highFat = true;
  }
  return { collision, seedOil, highFat };
}

/**
 * @param {string} ts
 * @returns {string}
 */
export function formatSnapshotTime(ts){
  const d = new Date(ts);
  if(Number.isNaN(d.getTime())) return String(ts || "");
  return d.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * @param {string} value
 * @returns {string[]}
 */
export function parseCommaList(value){
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export {};
