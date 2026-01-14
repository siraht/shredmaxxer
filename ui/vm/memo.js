// @ts-check

/**
 * Create a simple memo cache keyed by id + version.
 */
export function createKeyedMemo(){
  /** @type {Map<string, {version: string, value: any}>} */
  const cache = new Map();
  return function memo(key, version, compute){
    const prev = cache.get(key);
    if(prev && prev.version === version){
      return prev.value;
    }
    const value = compute();
    cache.set(key, { version, value });
    return value;
  };
}

/**
 * Build a lightweight roster version string for memo invalidation.
 * @param {any} rosters
 * @returns {string}
 */
export function rosterVersion(rosters){
  const cats = ["proteins", "carbs", "fats", "micros", "supplements"];
  let count = 0;
  let maxTs = "";
  for(const cat of cats){
    const list = Array.isArray(rosters?.[cat]) ? rosters[cat] : [];
    for(const item of list){
      if(!item || typeof item !== "object") continue;
      count += 1;
      const ts = item.tsUpdated || item.tsCreated || "";
      if(ts && (!maxTs || ts > maxTs)) maxTs = ts;
    }
  }
  return `${count}|${maxTs}`;
}
