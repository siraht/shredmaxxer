// @ts-check

/**
 * Ensure segment metadata fields exist.
 * @param {any} segment
 */
export function ensureSegmentMeta(segment){
  if(!segment || typeof segment !== "object") return;
  if(!Number.isFinite(segment.rev)) segment.rev = 0;
  if(typeof segment.tsFirst !== "string") segment.tsFirst = "";
  if(typeof segment.tsLast !== "string") segment.tsLast = "";
}

/**
 * Ensure day metadata fields exist.
 * @param {any} day
 */
export function ensureDayMeta(day){
  if(!day || typeof day !== "object") return;
  if(!Number.isFinite(day.rev)) day.rev = 0;
  if(typeof day.tsCreated !== "string") day.tsCreated = "";
  if(typeof day.tsLast !== "string") day.tsLast = "";
}

/**
 * Touch a segment: set tsFirst once, tsLast always, rev++.
 * Mutates the segment object.
 * @param {any} segment
 * @param {string} [iso]
 */
export function touchSegment(segment, iso){
  if(!segment || typeof segment !== "object") return;
  const stamp = typeof iso === "string" ? iso : new Date().toISOString();
  if(!segment.tsFirst) segment.tsFirst = stamp;
  segment.tsLast = stamp;
  segment.rev = Number.isFinite(segment.rev) ? segment.rev + 1 : 1;
}

/**
 * Touch a day: set tsCreated once, tsLast always, rev++.
 * Mutates the day object.
 * @param {any} day
 * @param {string} [iso]
 */
export function touchDay(day, iso){
  if(!day || typeof day !== "object") return;
  const stamp = typeof iso === "string" ? iso : new Date().toISOString();
  if(!day.tsCreated) day.tsCreated = stamp;
  day.tsLast = stamp;
  day.rev = Number.isFinite(day.rev) ? day.rev + 1 : 1;
}

export {};
