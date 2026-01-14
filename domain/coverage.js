// @ts-check

import { effectiveSegmentFlags } from "./heuristics.js";

const CATEGORIES = ["proteins", "carbs", "fats", "micros"];

/**
 * Compute per-day category counts and flags.
 * @param {any} day
 * @param {any} rosters
 * @returns {{counts: Record<string, number>, flags: {collision:boolean, seedOil:boolean, highFat:boolean}}}
 */
export function computeDayCoverage(day, rosters){
  const counts = { proteins: 0, carbs: 0, fats: 0, micros: 0 };
  const sets = {
    proteins: new Set(),
    carbs: new Set(),
    fats: new Set(),
    micros: new Set()
  };

  let collision = false;
  let seedOil = false;
  let highFat = false;

  const segments = day?.segments || {};
  for(const seg of Object.values(segments)){
    if(!seg) continue;
    for(const cat of CATEGORIES){
      const items = Array.isArray(seg[cat]) ? seg[cat] : [];
      items.forEach((item) => sets[cat].add(item));
    }

    const effective = effectiveSegmentFlags(seg, rosters || {});
    if(effective.collision.value) collision = true;
    if(effective.highFatMeal.value) highFat = true;
    if(seg.seedOil === "yes") seedOil = true;
  }

  for(const cat of CATEGORIES){
    counts[cat] = sets[cat].size;
  }

  return { counts, flags: { collision, seedOil, highFat } };
}

/**
 * Build coverage matrix rows for a set of DateKeys.
 * @param {Record<string, any>} logs
 * @param {any} rosters
 * @param {string[]} dateKeys
 * @returns {Array<{dateKey:string, counts:Record<string, number>, flags:{collision:boolean, seedOil:boolean, highFat:boolean}}>}
 */
export function computeCoverageMatrix(logs, rosters, dateKeys){
  const list = Array.isArray(dateKeys) ? dateKeys : [];
  return list.map((dateKey) => {
    const day = logs?.[dateKey];
    const coverage = computeDayCoverage(day || {}, rosters);
    return { dateKey, ...coverage };
  });
}

export default {
  computeDayCoverage,
  computeCoverageMatrix
};
