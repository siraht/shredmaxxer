// @ts-check

/**
 * Parse HH:MM (24h) into minutes since midnight.
 * Returns 0 on invalid input.
 * @param {string} hhmm
 * @returns {number}
 */
export function parseTimeToMinutes(hhmm){
  if(!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return 0;
  const [h,m] = hhmm.split(":").map(Number);
  return (h * 60 + m);
}

/**
 * Convert minutes since midnight to HH:MM (24h), normalized to [0,1439].
 * @param {number} minutes
 * @returns {string}
 */
export function minutesToTime(minutes){
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Clamp a number between min and max.
 * @param {number} n
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampNumber(n, min, max){
  return Math.max(min, Math.min(max, n));
}

/**
 * Result of local-time clamping to handle DST gaps/overlaps.
 * @typedef {Object} LocalTimeClamp
 * @property {number} minutes   Minutes since midnight after clamping
 * @property {boolean} clamped  True if time was adjusted due to a DST gap
 * @property {""|"gap"|"ambiguous"} reason
 * @property {number} offsetMinutes  Timezone offset in minutes at resolved time
 */

/**
 * Clamp a local wall-clock time to a representable time on the given date.
 *
 * Policy:
 * - If a time falls into a DST gap, clamp **forward** to the first valid time.
 * - If a time is ambiguous (fall-back hour), keep the earlier occurrence but
 *   flag it as ambiguous for diagnostics.
 *
 * This policy preserves monotonic boundaries and is deterministic.
 *
 * @param {Date} date
 * @param {number} minutes 0..1439
 * @returns {LocalTimeClamp}
 */
export function clampLocalTime(date, minutes){
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);

  const resolvedMinutes = d.getHours() * 60 + d.getMinutes();
  const clamped = resolvedMinutes !== minutes || d.getDate() !== date.getDate();
  let reason = "";

  if(clamped){
    reason = "gap";
  }else{
    // Detect ambiguous local times (fall-back hour) by checking if adding
    // one hour lands on the same local clock time.
    const dPlus = new Date(d.getTime() + 60 * 60 * 1000);
    if(dPlus.getHours() === d.getHours() && dPlus.getMinutes() === d.getMinutes()){
      reason = "ambiguous";
    }
  }

  return {
    minutes: resolvedMinutes,
    clamped,
    reason,
    offsetMinutes: -d.getTimezoneOffset()
  };
}

/**
 * Lift a boundary into the protocol-day timeline so it is >= start.
 * @param {number} start
 * @param {number} boundary
 * @returns {number}
 */
export function liftBoundary(start, boundary){
  return boundary < start ? boundary + 1440 : boundary;
}

/**
 * Compute monotonic protocol-day boundaries from settings (minutes).
 * @param {{dayStart:string, dayEnd:string, ftnEnd:string, lunchEnd:string, dinnerEnd:string}} settings
 * @returns {{start:number, end:number, ftnEnd:number, lunchEnd:number, dinnerEnd:number}}
 */
export function computeProtocolBoundaries(settings){
  const start = parseTimeToMinutes(settings.dayStart);
  let end = liftBoundary(start, parseTimeToMinutes(settings.dayEnd));
  if(end === start){
    end += 1440;
  }

  let ftnEnd = liftBoundary(start, parseTimeToMinutes(settings.ftnEnd));
  let lunchEnd = liftBoundary(start, parseTimeToMinutes(settings.lunchEnd));
  let dinnerEnd = liftBoundary(start, parseTimeToMinutes(settings.dinnerEnd));

  // Ensure monotonic boundaries to avoid negative spans.
  ftnEnd = clampNumber(ftnEnd, start, end);
  lunchEnd = clampNumber(lunchEnd, ftnEnd, end);
  dinnerEnd = clampNumber(dinnerEnd, lunchEnd, end);

  return { start, end, ftnEnd, lunchEnd, dinnerEnd };
}

/**
 * Build segment windows for the protocol day.
 * @param {{dayStart:string, dayEnd:string, ftnEnd:string, lunchEnd:string, dinnerEnd:string}} settings
 * @returns {Array<{id:"ftn"|"lunch"|"dinner"|"late", start:number, end:number}>}
 */
export function computeSegmentWindows(settings){
  const { start, end, ftnEnd, lunchEnd, dinnerEnd } = computeProtocolBoundaries(settings);
  return [
    { id: "ftn", start, end: ftnEnd },
    { id: "lunch", start: ftnEnd, end: lunchEnd },
    { id: "dinner", start: lunchEnd, end: dinnerEnd },
    { id: "late", start: dinnerEnd, end }
  ];
}

/**
 * Format a local Date into a canonical DateKey (YYYY-MM-DD).
 * @param {Date} date
 * @returns {string}
 */
export function dateToKey(date){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Shift a local Date by whole days using a noon anchor to avoid DST surprises.
 * @param {Date} date
 * @param {number} deltaDays
 * @returns {Date}
 */
export function addDaysLocal(date, deltaDays){
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + deltaDays,
    12,
    0,
    0,
    0
  );
}

/**
 * Resolve the active protocol day DateKey for the given time.
 * For wrap-around days, times after midnight but before dayEnd map to yesterday.
 * @param {Date} now
 * @param {{dayStart:string, dayEnd:string}} settings
 * @returns {string}
 */
export function activeDayKey(now, settings){
  const dayStart = parseTimeToMinutes(settings.dayStart);
  const dayEnd = parseTimeToMinutes(settings.dayEnd);
  const wraps = dayEnd <= dayStart;

  if(!wraps){
    return dateToKey(now);
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const endClamp = clampLocalTime(now, dayEnd).minutes;

  if(nowMinutes < endClamp){
    return dateToKey(addDaysLocal(now, -1));
  }

  return dateToKey(now);
}
