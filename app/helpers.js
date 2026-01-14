// @ts-check

import { normalizeTri } from "../domain/heuristics.js";

/**
 * Merge settings objects, merging privacy and stripping legacy appLockHash.
 * @param {any} base
 * @param {any} next
 * @returns {any}
 */
export function mergeSettings(base, next){
  const merged = { ...(base || {}), ...(next || {}) };
  if(base?.privacy || next?.privacy){
    merged.privacy = { ...(base?.privacy || {}), ...(next?.privacy || {}) };
  }
  if(base?.sync || next?.sync){
    merged.sync = { ...(base?.sync || {}), ...(next?.sync || {}) };
  }
  if(base?.ui || next?.ui){
    merged.ui = { ...(base?.ui || {}), ...(next?.ui || {}) };
  }
  if(merged.privacy && Object.prototype.hasOwnProperty.call(merged.privacy, "appLockHash")){
    delete merged.privacy.appLockHash;
  }
  return merged;
}

/**
 * Build a default day log object.
 * @returns {any}
 */
export function createDefaultDay(){
  return {
    segments: {
      ftn: { status: "unlogged", ftnMode: "", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 },
      lunch: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 },
      dinner: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 },
      late: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 }
    },
    supplements: { mode: "none", items: [], notes: "", tsLast: "" },
    movedBeforeLunch: false,
    trained: false,
    highFatDay: "auto",
    energy: "",
    mood: "",
    cravings: "",
    notes: "",
    tsCreated: "",
    tsLast: "",
    rev: 0
  };
}

/**
 * Determine whether a segment has any content.
 * @param {any} seg
 * @param {string} segId
 * @returns {boolean}
 */
export function segmentHasContent(seg, segId){
  if(!seg) return false;
  const hasItems = (seg.proteins?.length || 0)
    || (seg.carbs?.length || 0)
    || (seg.fats?.length || 0)
    || (seg.micros?.length || 0);
  const collision = normalizeTri(seg.collision);
  const highFatMeal = normalizeTri(seg.highFatMeal);
  const hasFlags = collision !== "auto" || highFatMeal !== "auto" || seg.seedOil || seg.notes;
  const hasFtn = segId === "ftn" && seg.ftnMode;
  return !!(hasItems || hasFlags || hasFtn);
}

/**
 * Clear content fields for a segment (mutates in place).
 * @param {any} seg
 * @param {string} segId
 */
export function clearSegmentContents(seg, segId){
  seg.proteins = [];
  seg.carbs = [];
  seg.fats = [];
  seg.micros = [];
  seg.collision = "auto";
  seg.highFatMeal = "auto";
  seg.seedOil = "";
  seg.notes = "";
  if(segId === "ftn") seg.ftnMode = "";
}

/**
 * Sync segment status based on contents (mutates in place).
 * @param {any} seg
 * @param {string} segId
 */
export function syncSegmentStatus(seg, segId){
  const hasContent = segmentHasContent(seg, segId);
  if(hasContent){
    seg.status = "logged";
    return;
  }
  if(seg.status !== "none"){
    seg.status = "unlogged";
  }
}

export {};
