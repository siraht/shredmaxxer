// @ts-check

import { effectiveSegmentFlags } from "../domain/heuristics.js";

const SEGMENT_IDS = ["ftn", "lunch", "dinner", "late"];

/**
 * @param {any} rosters
 */
function buildLabelMap(rosters){
  const map = new Map();
  const cats = ["proteins", "carbs", "fats", "micros", "supplements"];
  for(const cat of cats){
    const list = Array.isArray(rosters?.[cat]) ? rosters[cat] : [];
    for(const item of list){
      if(item && typeof item === "object" && item.id && item.label){
        map.set(String(item.id), String(item.label));
      }else if(typeof item === "string"){
        map.set(item, item);
      }
    }
  }
  return map;
}

/**
 * @param {string[]|undefined} items
 * @param {Map<string,string>} labelMap
 */
function formatItems(items, labelMap){
  if(!Array.isArray(items)) return "";
  return items.map((id) => labelMap.get(String(id)) || String(id)).join("|");
}

/**
 * @param {any} value
 */
function csvEscape(value){
  const str = value == null ? "" : String(value);
  if(/[",\n]/.test(str)){
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function boolToInt(value){
  return value ? "1" : "0";
}

/**
 * @param {any} segments
 * @param {any} rosters
 */
function computeIssueCounts(segments, rosters){
  let collision = 0;
  let seedOil = 0;
  let highFatMeal = 0;
  for(const id of SEGMENT_IDS){
    const seg = segments?.[id];
    if(!seg) continue;
    const effective = effectiveSegmentFlags(seg, rosters);
    if(effective.collision.value) collision += 1;
    if(seg.seedOil === "yes") seedOil += 1;
    if(effective.highFatMeal.value) highFatMeal += 1;
  }
  return { collision, seedOil, highFatMeal };
}

/**
 * Build CSV export text for analysis.
 * @param {any} state
 */
export function buildCsvExport(state){
  const base = state && typeof state === "object" ? state : {};
  const logs = base.logs && typeof base.logs === "object" ? base.logs : {};
  const settings = base.settings || {};
  const rosters = base.rosters || {};
  const labelMap = buildLabelMap(rosters);

  const header = [
    "date",
    "phase",
    "energy",
    "mood",
    "cravings",
    "moved_before_lunch",
    "trained",
    "high_fat_day",
    "collision_count",
    "seed_oil_count",
    "high_fat_meal_count",
    "ftn_mode",
    "ftn_proteins",
    "ftn_carbs",
    "ftn_fats",
    "ftn_micros",
    "lunch_proteins",
    "lunch_carbs",
    "lunch_fats",
    "lunch_micros",
    "dinner_proteins",
    "dinner_carbs",
    "dinner_fats",
    "dinner_micros",
    "late_proteins",
    "late_carbs",
    "late_fats",
    "late_micros"
  ];

  const rows = [header.join(",")];
  const keys = Object.keys(logs).sort();

  for(const dateKey of keys){
    const day = logs[dateKey] || {};
    const segments = day.segments || {};
    const issues = computeIssueCounts(segments, rosters);

    const row = [
      dateKey,
      settings.phase || "",
      day.energy || "",
      day.mood || "",
      day.cravings || "",
      boolToInt(day.movedBeforeLunch),
      boolToInt(day.trained),
      boolToInt(day.highFatDay),
      String(issues.collision),
      String(issues.seedOil),
      String(issues.highFatMeal),
      segments.ftn?.ftnMode || "",
      formatItems(segments.ftn?.proteins, labelMap),
      formatItems(segments.ftn?.carbs, labelMap),
      formatItems(segments.ftn?.fats, labelMap),
      formatItems(segments.ftn?.micros, labelMap),
      formatItems(segments.lunch?.proteins, labelMap),
      formatItems(segments.lunch?.carbs, labelMap),
      formatItems(segments.lunch?.fats, labelMap),
      formatItems(segments.lunch?.micros, labelMap),
      formatItems(segments.dinner?.proteins, labelMap),
      formatItems(segments.dinner?.carbs, labelMap),
      formatItems(segments.dinner?.fats, labelMap),
      formatItems(segments.dinner?.micros, labelMap),
      formatItems(segments.late?.proteins, labelMap),
      formatItems(segments.late?.carbs, labelMap),
      formatItems(segments.late?.fats, labelMap),
      formatItems(segments.late?.micros, labelMap)
    ];

    rows.push(row.map(csvEscape).join(","));
  }

  return rows.join("\n");
}

export {};
