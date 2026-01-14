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
 * Inspect protocol boundary times for DST clamping on a given date.
 * @param {Date} date
 * @param {{dayStart:string, dayEnd:string, ftnEnd:string, lunchEnd:string, dinnerEnd:string}} settings
 * @returns {{
 *  applied: boolean,
 *  ambiguous: boolean,
 *  fields: Array<{field:string, minutes:number, resolvedMinutes:number, reason:""|"gap"|"ambiguous", offsetMinutes:number}>
 * }}
 */
export function inspectDstClamp(date, settings){
  const d = (date instanceof Date) ? date : new Date();
  const fields = ["dayStart", "dayEnd", "ftnEnd", "lunchEnd", "dinnerEnd"];
  const results = [];
  let applied = false;
  let ambiguous = false;
  for(const field of fields){
    const minutes = parseTimeToMinutes(settings?.[field]);
    const clamp = clampLocalTime(d, minutes);
    if(clamp.clamped || clamp.reason){
      results.push({
        field,
        minutes,
        resolvedMinutes: clamp.minutes,
        reason: clamp.reason,
        offsetMinutes: clamp.offsetMinutes
      });
      if(clamp.clamped) applied = true;
      if(clamp.reason === "ambiguous") ambiguous = true;
    }
  }
  return { applied, ambiguous, fields: results };
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

function toRadians(deg){
  return deg * (Math.PI / 180);
}

function toDegrees(rad){
  return rad * (180 / Math.PI);
}

function normalizeDegrees(deg){
  let out = deg % 360;
  if(out < 0) out += 360;
  return out;
}

function dayOfYear(date){
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

/**
 * Compute sunrise/sunset for a date and location (local minutes).
 * Returns nulls for polar day/night.
 * @param {Date} date
 * @param {number} lat
 * @param {number} lon
 * @returns {{sunrise:number|null, sunset:number|null, status:"ok"|"polarDay"|"polarNight"}}
 */
export function computeSunTimes(date, lat, lon){
  const d = date instanceof Date ? date : new Date();
  const zenith = 90.833; // official
  const N = dayOfYear(d);
  const lngHour = lon / 15;

  const calcTime = (isSunrise) => {
    const t = N + ((isSunrise ? 6 : 18) - lngHour) / 24;
    const M = (0.9856 * t) - 3.289;
    let L = M + (1.916 * Math.sin(toRadians(M))) + (0.020 * Math.sin(toRadians(2 * M))) + 282.634;
    L = normalizeDegrees(L);

    let RA = toDegrees(Math.atan(0.91764 * Math.tan(toRadians(L))));
    RA = normalizeDegrees(RA);
    const Lquadrant = Math.floor(L / 90) * 90;
    const RAquadrant = Math.floor(RA / 90) * 90;
    RA = RA + (Lquadrant - RAquadrant);
    RA = RA / 15;

    const sinDec = 0.39782 * Math.sin(toRadians(L));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(toRadians(zenith)) - (sinDec * Math.sin(toRadians(lat))))
      / (cosDec * Math.cos(toRadians(lat)));

    if(cosH > 1) return { status: "polarNight", minutes: null };
    if(cosH < -1) return { status: "polarDay", minutes: null };

    let H = isSunrise ? (360 - toDegrees(Math.acos(cosH))) : toDegrees(Math.acos(cosH));
    H = H / 15;
    const T = H + RA - (0.06571 * t) - 6.622;
    let UT = T - lngHour;
    UT = ((UT % 24) + 24) % 24;

    const utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const local = new Date(utcMidnight + (UT * 3600000));
    const minutes = (local.getHours() * 60 + local.getMinutes()) % 1440;
    return { status: "ok", minutes };
  };

  const rise = calcTime(true);
  const set = calcTime(false);
  if(rise.status !== "ok") return { sunrise: null, sunset: null, status: rise.status };
  if(set.status !== "ok") return { sunrise: null, sunset: null, status: set.status };
  return { sunrise: rise.minutes, sunset: set.minutes, status: "ok" };
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
