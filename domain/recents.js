// @ts-check

const DEFAULT_SEGMENT_ORDER = ["ftn", "lunch", "dinner", "late"];

/**
 * @typedef {Object} RecentsOptions
 * @property {number} [limit]
 * @property {string[]} [segmentOrder]
 */

/**
 * Return DateKeys sorted descending (newest first).
 * @param {Record<string, any>} logs
 * @returns {string[]}
 */
export function sortDateKeysDesc(logs){
  return Object.keys(logs || {}).sort().reverse();
}

/**
 * Compute recents for a single category (proteins/carbs/fats/micros).
 * Deterministic order: newest date -> segment order -> item order.
 * @param {Record<string, any>} logs
 * @param {"proteins"|"carbs"|"fats"|"micros"} category
 * @param {RecentsOptions} [options]
 * @returns {string[]}
 */
export function computeRecents(logs, category, options = {}){
  const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : 8;
  const segmentOrder = Array.isArray(options.segmentOrder) ? options.segmentOrder : DEFAULT_SEGMENT_ORDER;
  const seen = new Set();
  const out = [];

  for(const dateKey of sortDateKeysDesc(logs)){
    const day = logs?.[dateKey];
    if(!day || !day.segments) continue;
    for(const segId of segmentOrder){
      const seg = day.segments?.[segId];
      const items = Array.isArray(seg?.[category]) ? seg[category] : [];
      for(const itemId of items){
        if(!seen.has(itemId)){
          seen.add(itemId);
          out.push(itemId);
          if(out.length >= limit){
            return out;
          }
        }
      }
    }
  }

  return out;
}

/**
 * Compute recents for all categories at once.
 * @param {Record<string, any>} logs
 * @param {RecentsOptions} [options]
 * @returns {{proteins:string[], carbs:string[], fats:string[], micros:string[]}}
 */
export function computeAllRecents(logs, options = {}){
  return {
    proteins: computeRecents(logs, "proteins", options),
    carbs: computeRecents(logs, "carbs", options),
    fats: computeRecents(logs, "fats", options),
    micros: computeRecents(logs, "micros", options)
  };
}

export default {
  computeRecents,
  computeAllRecents,
  sortDateKeysDesc
};
