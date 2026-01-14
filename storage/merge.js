// @ts-check

/**
 * @typedef {Object} MergeOptions
 * @property {boolean} [unionItems]
 * @property {boolean} [dedupeByLabel]
 */

function normalizeLabel(label){
  return String(label || "").trim().toLowerCase();
}

function toIsoMs(value){
  if(typeof value !== "string" || !value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function compareByRevAndTime(aRev, aTs, bRev, bTs){
  if(aRev !== bRev) return aRev > bRev ? 1 : -1;
  const aMs = toIsoMs(aTs);
  const bMs = toIsoMs(bTs);
  if(aMs === bMs) return 0;
  return aMs > bMs ? 1 : -1;
}

/**
 * @param {any} a
 * @param {any} b
 * @returns {number}
 */
function compareRecords(a, b){
  const aRev = Number.isFinite(a?.rev) ? a.rev : 0;
  const bRev = Number.isFinite(b?.rev) ? b.rev : 0;
  const aTs = a?.tsLast || "";
  const bTs = b?.tsLast || "";
  return compareByRevAndTime(aRev, aTs, bRev, bTs);
}

/**
 * @param {any} segA
 * @param {any} segB
 * @param {MergeOptions} [options]
 * @returns {any}
 */
export function mergeSegment(segA, segB, options = {}){
  if(!segA) return segB;
  if(!segB) return segA;

  const cmp = compareRecords(segA, segB);
  const winner = cmp >= 0 ? segA : segB;
  const loser = cmp >= 0 ? segB : segA;

  if(!options.unionItems){
    return winner;
  }

  const mergeArray = (a, b) => {
    const out = [];
    const seen = new Set();
    (Array.isArray(a) ? a : []).forEach((x) => {
      if(!seen.has(x)){
        seen.add(x);
        out.push(x);
      }
    });
    (Array.isArray(b) ? b : []).forEach((x) => {
      if(!seen.has(x)){
        seen.add(x);
        out.push(x);
      }
    });
    return out;
  };

  const merged = { ...winner };
  merged.proteins = mergeArray(winner.proteins, loser.proteins);
  merged.carbs = mergeArray(winner.carbs, loser.carbs);
  merged.fats = mergeArray(winner.fats, loser.fats);
  merged.micros = mergeArray(winner.micros, loser.micros);

  const winTs = toIsoMs(winner.tsLast);
  const loseTs = toIsoMs(loser.tsLast);
  merged.tsLast = winTs >= loseTs ? winner.tsLast : loser.tsLast;

  return merged;
}

/**
 * @param {any} dayA
 * @param {any} dayB
 * @param {MergeOptions} [options]
 * @returns {any}
 */
export function mergeDay(dayA, dayB, options = {}){
  if(!dayA) return dayB;
  if(!dayB) return dayA;

  const cmp = compareRecords(dayA, dayB);
  const winner = cmp >= 0 ? dayA : dayB;
  const loser = cmp >= 0 ? dayB : dayA;

  const merged = { ...winner };
  const segIds = ["ftn", "lunch", "dinner", "late"];
  merged.segments = { ...(winner?.segments || {}) };

  for(const id of segIds){
    merged.segments[id] = mergeSegment(
      winner?.segments?.[id],
      loser?.segments?.[id],
      options
    );
  }

  return merged;
}

/**
 * @param {any[]} listA
 * @param {any[]} listB
 * @param {MergeOptions} [options]
 * @returns {any[]}
 */
export function mergeRosterList(listA, listB, options = {}){
  const out = [];
  const byId = new Map();
  const byLabel = new Map();
  const pushItem = (item) => {
    if(!item || !item.id) return;
    if(byId.has(item.id)){
      const existing = byId.get(item.id);
      const pick = compareByRevAndTime(
        0,
        existing?.tsUpdated || "",
        0,
        item?.tsUpdated || ""
      ) >= 0 ? existing : item;
      byId.set(item.id, pick);
      return;
    }
    if(options.dedupeByLabel){
      const labelKey = normalizeLabel(item.label);
      if(labelKey && byLabel.has(labelKey)){
        return;
      }
      if(labelKey){
        byLabel.set(labelKey, item.id);
      }
    }
    byId.set(item.id, item);
  };

  (Array.isArray(listA) ? listA : []).forEach(pushItem);
  (Array.isArray(listB) ? listB : []).forEach(pushItem);

  for(const item of byId.values()){
    out.push(item);
  }
  return out;
}

/**
 * @param {any} rostersA
 * @param {any} rostersB
 * @param {MergeOptions} [options]
 * @returns {any}
 */
export function mergeRosters(rostersA, rostersB, options = {}){
  if(!rostersA) return rostersB;
  if(!rostersB) return rostersA;
  const merged = { ...rostersA };
  const cats = ["proteins", "carbs", "fats", "micros", "supplements"];
  for(const cat of cats){
    merged[cat] = mergeRosterList(rostersA[cat], rostersB[cat], options);
  }
  return merged;
}

export default {
  mergeSegment,
  mergeDay,
  mergeRosterList,
  mergeRosters
};
