// @ts-check

const SEGMENTS = ["ftn", "lunch", "dinner", "late"];
const CATEGORIES = ["proteins", "carbs", "fats", "micros"];

/**
 * Normalize roster entries to objects with id/label.
 * @param {any[]} roster
 * @returns {{id:string, label:string, archived?:boolean}[]}
 */
function normalizeRoster(roster){
  return (Array.isArray(roster) ? roster : [])
    .map((entry) => {
      if(typeof entry === "string"){
        return { id: entry, label: entry, archived: false };
      }
      return entry;
    })
    .filter((entry) => entry && entry.id);
}

/**
 * Build a map of itemId -> last used DateKey (newest first).
 * @param {Record<string, any>} logs
 * @param {string[]} [dateKeys]
 * @returns {Record<string, Map<string, string>>}
 */
export function computeLastUsed(logs, dateKeys){
  const out = {};
  for(const cat of CATEGORIES){
    out[cat] = new Map();
  }
  const keys = Array.isArray(dateKeys) && dateKeys.length
    ? [...dateKeys]
    : Object.keys(logs || {}).sort().reverse();

  for(const dateKey of keys){
    const day = logs?.[dateKey];
    if(!day || !day.segments) continue;
    for(const segId of SEGMENTS){
      const seg = day.segments?.[segId];
      if(!seg) continue;
      for(const cat of CATEGORIES){
        const list = Array.isArray(seg?.[cat]) ? seg[cat] : [];
        const map = out[cat];
        for(const id of list){
          if(!map.has(id)){
            map.set(id, dateKey);
          }
        }
      }
    }
  }

  return out;
}

/**
 * Compute least-recently-used rotation picks.
 * @param {{rosters:any, logs:Record<string, any>}} state
 * @param {{limitPerCategory?:number, dateKeys?:string[]}} [options]
 * @returns {Record<string, {id:string, label:string, lastUsed:string|null}[]>}
 */
export function computeRotationPicks(state, options = {}){
  const limit = Number.isFinite(options.limitPerCategory)
    ? Math.max(0, options.limitPerCategory)
    : 2;
  const rosters = state?.rosters || {};
  const logs = state?.logs || {};
  const lastUsed = computeLastUsed(logs, options.dateKeys);
  const picks = {};

  for(const cat of CATEGORIES){
    const items = normalizeRoster(rosters[cat])
      .filter((item) => !item.archived);
    const sorted = items
      .map((item) => ({
        id: item.id,
        label: item.label || item.id,
        lastUsed: lastUsed[cat]?.get(item.id) || null
      }))
      .sort((a, b) => {
        if(a.lastUsed && !b.lastUsed) return 1;
        if(!a.lastUsed && b.lastUsed) return -1;
        if(a.lastUsed && b.lastUsed){
          if(a.lastUsed !== b.lastUsed){
            return a.lastUsed.localeCompare(b.lastUsed);
          }
        }
        return a.label.localeCompare(b.label);
      });

    picks[cat] = sorted.slice(0, limit);
  }

  return picks;
}

export default {
  computeLastUsed,
  computeRotationPicks
};
