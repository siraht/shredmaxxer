// @ts-check

import { parseHlc } from "./hlc.js";

/**
 * Generate the next HLC string using the last observed HLC.
 * Format: "<unix_ms>:<counter>:<actor>".
 * @param {string} lastHlc
 * @param {string} actor
 * @param {number} [nowMs]
 * @returns {string}
 */
export function nextHlc(lastHlc, actor, nowMs){
  const parsed = parseHlc(lastHlc);
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  let ms = now;
  let counter = 0;

  if(parsed){
    if(ms < parsed.ms){
      ms = parsed.ms;
      counter = parsed.counter + 1;
    }else if(ms === parsed.ms){
      counter = parsed.counter + 1;
    }
  }

  const actorId = typeof actor === "string" ? actor : "";
  return `${ms}:${counter}:${actorId}`;
}

/**
 * Create a simple HLC clock that keeps local monotonicity.
 * @param {string} actor
 * @param {string} [initialHlc]
 */
export function createHlcClock(actor, initialHlc){
  let last = typeof initialHlc === "string" ? initialHlc : "";

  return {
    /**
     * @param {number} [nowMs]
     * @returns {string}
     */
    tick(nowMs){
      last = nextHlc(last, actor, nowMs);
      return last;
    },
    /** @returns {string} */
    getLast(){
      return last;
    },
    /** @param {string} value */
    setLast(value){
      if(typeof value === "string") last = value;
    }
  };
}

export {};
