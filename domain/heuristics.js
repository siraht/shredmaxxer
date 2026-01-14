// @ts-check

import { buildTagIndex, computeCollisionAuto, computeHighFatMealAuto, computeSegmentFlags } from "./flags.js";

/**
 * @typedef {import("./schema.js").Tri} Tri
 * @typedef {import("./schema.js").SegmentLog} SegmentLog
 * @typedef {import("./schema.js").Rosters} Rosters
 */

/**
 * Normalize tri-state values. Empty/unknown values fall back to "auto".
 * @param {Tri | string | null | undefined} value
 * @returns {"auto"|"yes"|"no"}
 */
export function normalizeTri(value){
  if(value === true) return "yes";
  if(value === false) return "no";
  if(value === "yes" || value === "no" || value === "auto") return value;
  if(value === "" || value == null) return "auto";
  return "auto";
}

/**
 * Compute effective flags for a segment (tri-state overrides + auto rule).
 * Includes auto booleans for diagnostics/UX hints.
 * @param {SegmentLog} segment
 * @param {Rosters} rosters
 * @returns {{
 *  collision: { value: boolean, source: "auto"|"yes"|"no" },
 *  highFatMeal: { value: boolean, source: "auto"|"yes"|"no" },
 *  collisionAuto: boolean,
 *  highFatMealAuto: boolean,
 *  seedOilHint: boolean
 * }}
 */
export function effectiveSegmentFlags(segment, rosters){
  const tagIndex = buildTagIndex(rosters || {});
  const collisionOverride = normalizeTri(segment?.collision);
  const highFatOverride = normalizeTri(segment?.highFatMeal);
  const normalizedSegment = {
    ...segment,
    collision: collisionOverride,
    highFatMeal: highFatOverride
  };
  const computed = computeSegmentFlags(normalizedSegment, tagIndex);
  return {
    collision: {
      value: computed.collisionEffective === "yes",
      source: collisionOverride === "auto" ? "auto" : collisionOverride
    },
    highFatMeal: {
      value: computed.highFatMealEffective === "yes",
      source: highFatOverride === "auto" ? "auto" : highFatOverride
    },
    collisionAuto: computed.collisionAuto,
    highFatMealAuto: computed.highFatMealAuto,
    seedOilHint: computed.seedOilHint
  };
}

/**
 * Compute effective high-fat day state (tri override + auto).
 * Auto uses any segment with effective highFatMeal = true.
 * @param {any} day
 * @param {Rosters} rosters
 * @returns {{ value: boolean, source: "auto"|"yes"|"no" }}
 */
export function effectiveHighFatDay(day, rosters){
  const override = normalizeTri(day?.highFatDay);
  if(override === "yes") return { value: true, source: "yes" };
  if(override === "no") return { value: false, source: "no" };
  const segments = day?.segments || {};
  for(const seg of Object.values(segments)){
    if(!seg || typeof seg !== "object") continue;
    const flags = effectiveSegmentFlags(seg, rosters);
    if(flags.highFatMeal.value){
      return { value: true, source: "auto" };
    }
  }
  return { value: false, source: "auto" };
}

export { buildTagIndex, computeCollisionAuto, computeHighFatMealAuto };

export {};
