// @ts-check

import { clearSegmentContents, createDefaultDay, syncSegmentStatus } from "./helpers.js";
import { touchSegment } from "../domain/revisions.js";

function cloneValue(value){
  if(typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/**
 * Apply a segment status change in-place.
 * @param {any} seg
 * @param {string} segId
 * @param {string} status
 * @param {string} nowIso
 * @returns {boolean}
 */
export function applySegmentStatus(seg, segId, status, nowIso){
  if(!seg) return false;
  if(status !== "unlogged" && status !== "none" && status !== "logged") return false;
  if(seg.status === status) return false;

  if(status === "none" || status === "unlogged"){
    clearSegmentContents(seg, segId);
    seg.status = status;
  }else{
    seg.status = "logged";
    syncSegmentStatus(seg, segId);
  }

  touchSegment(seg, nowIso);
  return true;
}

/**
 * Toggle a roster item in a segment array.
 * @param {any} seg
 * @param {string} segId
 * @param {string} category
 * @param {string} itemId
 * @param {string} nowIso
 * @returns {boolean}
 */
export function toggleSegmentItemInSegment(seg, segId, category, itemId, nowIso){
  if(!seg) return false;
  let arr = seg[category];
  if(!Array.isArray(arr)){
    arr = [];
    seg[category] = arr;
  }
  const idx = arr.indexOf(itemId);
  if(idx >= 0) arr.splice(idx, 1);
  else arr.push(itemId);
  syncSegmentStatus(seg, segId);
  touchSegment(seg, nowIso);
  return true;
}

/**
 * Copy a segment into a target slot, resetting timestamps/rev.
 * @param {string} targetSegId
 * @param {any} targetSeg
 * @param {any} sourceSeg
 * @param {string} nowIso
 * @returns {any}
 */
export function copySegmentFromSource(targetSegId, targetSeg, sourceSeg, nowIso){
  const clone = cloneValue(sourceSeg);
  if(targetSegId !== "ftn"){
    delete clone.ftnMode;
  }

  const next = { ...targetSeg, ...clone };
  if(targetSegId !== "ftn"){
    delete next.ftnMode;
  }
  next.tsFirst = "";
  next.tsLast = "";
  next.rev = 0;
  syncSegmentStatus(next, targetSegId);
  touchSegment(next, nowIso);
  return next;
}

/**
 * Copy all segments from a source day into the target day.
 * @param {any} day
 * @param {any} sourceDay
 * @param {string} nowIso
 */
export function copyDaySegmentsFromSource(day, sourceDay, nowIso){
  const base = createDefaultDay();
  const sourceSegments = sourceDay?.segments || {};
  for(const segId of Object.keys(base.segments)){
    const template = base.segments[segId];
    const incoming = sourceSegments[segId] || {};
    const next = { ...template, ...cloneValue(incoming) };
    if(segId !== "ftn") delete next.ftnMode;
    next.tsFirst = "";
    next.tsLast = "";
    next.rev = 0;
    syncSegmentStatus(next, segId);
    touchSegment(next, nowIso);
    day.segments[segId] = next;
  }
}

/**
 * Remove a roster item from a day log in-place.
 * @param {any} day
 * @param {string} category
 * @param {string} itemId
 * @param {string} nowIso
 * @returns {boolean}
 */
export function scrubRosterItemFromDay(day, category, itemId, nowIso){
  let dayChanged = false;
  if(category === "supplements"){
    const supp = (day.supplements && typeof day.supplements === "object")
      ? { ...day.supplements }
      : null;
    if(supp && Array.isArray(supp.items)){
      const next = supp.items.filter((id) => id !== itemId);
      if(next.length !== supp.items.length){
        supp.items = next;
        supp.tsLast = nowIso;
        day.supplements = supp;
        dayChanged = true;
      }
    }
    return dayChanged;
  }

  for(const [segId, seg] of Object.entries(day.segments || {})){
    if(!seg || typeof seg !== "object") continue;
    const arr = seg[category];
    if(!Array.isArray(arr)) continue;
    const next = arr.filter((id) => id !== itemId);
    if(next.length === arr.length) continue;
    seg[category] = next;
    syncSegmentStatus(seg, segId);
    touchSegment(seg, nowIso);
    dayChanged = true;
  }

  return dayChanged;
}

/**
 * Toggle a supplement item on a day.
 * @param {any} day
 * @param {string} itemId
 * @param {string} defaultMode
 * @param {string} nowIso
 * @returns {boolean}
 */
export function toggleSupplementItemInDay(day, itemId, defaultMode, nowIso){
  if(!itemId) return false;
  const supp = day.supplements && typeof day.supplements === "object"
    ? { ...day.supplements }
    : { mode: defaultMode, items: [], notes: "", tsLast: "" };
  if(!Array.isArray(supp.items)) supp.items = [];
  const idx = supp.items.indexOf(itemId);
  if(idx >= 0){
    supp.items.splice(idx, 1);
  }else{
    supp.items.push(itemId);
  }
  supp.mode = supp.mode || defaultMode;
  supp.tsLast = nowIso;
  day.supplements = supp;
  return true;
}

/**
 * Update supplements notes on a day.
 * @param {any} day
 * @param {string} notes
 * @param {string} defaultMode
 * @param {string} nowIso
 * @returns {boolean}
 */
export function setSupplementsNotesInDay(day, notes, defaultMode, nowIso){
  const supp = day.supplements && typeof day.supplements === "object"
    ? { ...day.supplements }
    : { mode: defaultMode, items: [], notes: "", tsLast: "" };
  const nextNotes = (typeof notes === "string") ? notes : String(notes || "");
  if(supp.notes === nextNotes) return false;
  supp.mode = supp.mode || defaultMode;
  supp.notes = nextNotes;
  supp.tsLast = nowIso;
  day.supplements = supp;
  return true;
}

export {};
