// @ts-check

import { buildTagIndex, computeSegmentFlags } from "../domain/flags.js";
import { effectiveHighFatDay } from "../domain/heuristics.js";

const SEGMENTS = ["ftn", "lunch", "dinner", "late"];
const CATEGORIES = ["proteins", "carbs", "fats", "micros"];

/**
 * @typedef {Object} CsvOptions
 * @property {string} [listDelimiter]
 * @property {boolean} [includeHeader]
 */

function buildLabelIndex(rosters){
  const map = new Map();
  const cats = ["proteins", "carbs", "fats", "micros", "supplements"];
  for(const cat of cats){
    const list = Array.isArray(rosters?.[cat]) ? rosters[cat] : [];
    for(const item of list){
      if(item && item.id){
        map.set(item.id, item.label || item.id);
      }
    }
  }
  return map;
}

function mapIdsToLabels(ids, labelIndex, delimiter){
  const list = Array.isArray(ids) ? ids : [];
  return list.map((id) => labelIndex.get(id) || id).join(delimiter);
}

function csvEscape(value){
  const str = String(value ?? "");
  if(/[",\n]/.test(str)){
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

/**
 * Build CSV rows for v4 state.
 * @param {any} state
 * @param {CsvOptions} [options]
 * @returns {{header:string[], rows:string[][]}}
 */
export function buildCsvRows(state, options = {}){
  const listDelimiter = options.listDelimiter || "|";
  const labelIndex = buildLabelIndex(state?.rosters || {});
  const tagIndex = buildTagIndex(state?.rosters || {});
  const logs = state?.logs && typeof state.logs === "object" ? state.logs : {};

  const header = [
    "date",
    "phase",
    "movedBeforeLunch",
    "trained",
    "highFatDay",
    "energy",
    "mood",
    "cravings",
    "collisionCount",
    "seedOilCount",
    "highFatMealCount",
    "ftnMode"
  ];

  for(const seg of SEGMENTS){
    for(const cat of CATEGORIES){
      header.push(`${seg}_${cat}`);
    }
  }

  header.push("notes");

  const rows = [];
  const dates = Object.keys(logs).sort();
  for(const dateKey of dates){
    const day = logs[dateKey] || {};
    let collisionCount = 0;
    let seedOilCount = 0;
    let highFatMealCount = 0;

    const segRows = [];
    for(const segId of SEGMENTS){
      const seg = day?.segments?.[segId] || {};
      const flags = computeSegmentFlags(seg, tagIndex);
      if(flags.collisionEffective === "yes") collisionCount += 1;
      if(flags.highFatMealEffective === "yes") highFatMealCount += 1;
      if(seg.seedOil === "yes") seedOilCount += 1;

      for(const cat of CATEGORIES){
        segRows.push(mapIdsToLabels(seg?.[cat], labelIndex, listDelimiter));
      }
    }

    rows.push([
      dateKey,
      state?.settings?.phase || "",
      day.movedBeforeLunch ? "1" : "0",
      day.trained ? "1" : "0",
      effectiveHighFatDay(day, state?.rosters || {}).value ? "1" : "0",
      day.energy || "",
      day.mood || "",
      day.cravings || "",
      String(collisionCount),
      String(seedOilCount),
      String(highFatMealCount),
      day?.segments?.ftn?.ftnMode || "",
      ...segRows,
      day.notes || ""
    ]);
  }

  return { header, rows };
}

/**
 * Serialize CSV text for export.
 * @param {any} state
 * @param {CsvOptions} [options]
 * @returns {string}
 */
export function serializeCsv(state, options = {}){
  const includeHeader = options.includeHeader !== false;
  const { header, rows } = buildCsvRows(state, options);
  const lines = [];
  if(includeHeader){
    lines.push(header.map(csvEscape).join(","));
  }
  for(const row of rows){
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export default {
  buildCsvRows,
  serializeCsv
};
