// @ts-check

/**
 * Build a map of itemId -> tags array from rosters.
 * @param {any} rosters
 * @returns {Map<string, string[]>}
 */
export function buildTagIndex(rosters){
  const map = new Map();
  const categories = ["proteins", "carbs", "fats", "micros", "supplements"];
  for(const cat of categories){
    const list = Array.isArray(rosters?.[cat]) ? rosters[cat] : [];
    for(const item of list){
      if(item && item.id){
        map.set(item.id, Array.isArray(item.tags) ? item.tags : []);
      }
    }
  }
  return map;
}

/**
 * @param {string[]} ids
 * @param {string} tag
 * @param {Map<string, string[]>} tagIndex
 * @returns {boolean}
 */
export function hasTag(ids, tag, tagIndex){
  const list = Array.isArray(ids) ? ids : [];
  for(const id of list){
    const tags = tagIndex.get(id) || [];
    if(tags.includes(tag)) return true;
  }
  return false;
}

/**
 * Resolve tri-state override with an auto boolean.
 * @param {""|"auto"|"yes"|"no"} value
 * @param {boolean} autoValue
 * @returns {"yes"|"no"}
 */
export function resolveTri(value, autoValue){
  if(value === true) return "yes";
  if(value === false) return "no";
  if(value === "yes") return "yes";
  if(value === "no") return "no";
  return autoValue ? "yes" : "no";
}

/**
 * Conservative collision heuristic: fat:dense + carb:starch.
 * @param {any} segment
 * @param {Map<string, string[]>} tagIndex
 * @returns {boolean}
 */
export function computeCollisionAuto(segment, tagIndex){
  const hasDenseFat = hasTag(segment?.fats, "fat:dense", tagIndex);
  const hasStarch = hasTag(segment?.carbs, "carb:starch", tagIndex);
  return hasDenseFat && hasStarch;
}

/**
 * Conservative high-fat meal heuristic: any fat tagged fat:dense.
 * @param {any} segment
 * @param {Map<string, string[]>} tagIndex
 * @returns {boolean}
 */
export function computeHighFatMealAuto(segment, tagIndex){
  return hasTag(segment?.fats, "fat:dense", tagIndex);
}

/**
 * Seed-oil hint based on fat tags.
 * @param {any} segment
 * @param {Map<string, string[]>} tagIndex
 * @returns {boolean}
 */
export function computeSeedOilHint(segment, tagIndex){
  return hasTag(segment?.fats, "fat:seed_oil", tagIndex) || hasTag(segment?.fats, "fat:unknown", tagIndex);
}

/**
 * Compute effective flags for a segment.
 * @param {any} segment
 * @param {Map<string, string[]>} tagIndex
 * @returns {{collisionAuto:boolean, highFatMealAuto:boolean, seedOilHint:boolean, collisionEffective:"yes"|"no", highFatMealEffective:"yes"|"no"}}
 */
export function computeSegmentFlags(segment, tagIndex){
  const collisionAuto = computeCollisionAuto(segment, tagIndex);
  const highFatMealAuto = computeHighFatMealAuto(segment, tagIndex);
  const seedOilHint = computeSeedOilHint(segment, tagIndex);
  const collisionValue = segment?.collision;
  const highFatValue = segment?.highFatMeal;
  const collisionTri = (collisionValue === "" || collisionValue == null) ? "auto" : collisionValue;
  const highFatTri = (highFatValue === "" || highFatValue == null) ? "auto" : highFatValue;
  return {
    collisionAuto,
    highFatMealAuto,
    seedOilHint,
    collisionEffective: resolveTri(collisionTri, collisionAuto),
    highFatMealEffective: resolveTri(highFatTri, highFatMealAuto)
  };
}

export default {
  buildTagIndex,
  hasTag,
  resolveTri,
  computeCollisionAuto,
  computeHighFatMealAuto,
  computeSeedOilHint,
  computeSegmentFlags
};
