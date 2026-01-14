// @ts-check

/**
 * Parse HLC string "<unix_ms>:<counter>:<actor>".
 * @param {string} hlc
 * @returns {{ ms:number, counter:number, actor:string } | null}
 */
export function parseHlc(hlc){
  if(typeof hlc !== "string") return null;
  const [msRaw, counterRaw, actorRaw] = hlc.split(":");
  const ms = Number(msRaw);
  const counter = Number(counterRaw);
  if(!Number.isFinite(ms) || !Number.isFinite(counter)) return null;
  return { ms, counter, actor: actorRaw || "" };
}

/**
 * Compare two HLC strings (ascending). Invalid values sort lowest.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareHlc(a, b){
  const parsedA = parseHlc(a);
  const parsedB = parseHlc(b);
  if(!parsedA && !parsedB) return 0;
  if(!parsedA) return -1;
  if(!parsedB) return 1;
  if(parsedA.ms !== parsedB.ms) return parsedA.ms - parsedB.ms;
  if(parsedA.counter !== parsedB.counter) return parsedA.counter - parsedB.counter;
  return parsedA.actor.localeCompare(parsedB.actor);
}

/**
 * Return the max HLC string using HLC ordering; invalid values sort lowest.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function maxHlc(a, b){
  return compareHlc(a, b) >= 0 ? String(a || "") : String(b || "");
}

export {};
