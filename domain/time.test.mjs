// @ts-check

import {
  activeDayKey,
  addDaysLocal,
  clampLocalTime,
  clampNumber,
  computeProtocolBoundaries,
  computeSegmentWindows,
  computeSunTimes,
  dateToKey,
  inspectDstClamp,
  liftBoundary,
  minutesToTime,
  parseTimeToMinutes
} from "./time.js";

function assertEqual(actual, expected, label){
  if(actual !== expected){
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

function assertBetween(value, min, max, label){
  if(!(value >= min && value <= max)){
    throw new Error(`${label}: expected between ${min} and ${max}, got ${value}`);
  }
}

function run(){
  assertEqual(parseTimeToMinutes("09:15"), 555, "parseTimeToMinutes parses HH:MM");
  assertEqual(parseTimeToMinutes("9:15"), 0, "parseTimeToMinutes rejects missing leading zero");
  assertEqual(parseTimeToMinutes(""), 0, "parseTimeToMinutes rejects empty");
  assertEqual(minutesToTime(0), "00:00", "minutesToTime at midnight");
  assertEqual(minutesToTime(1440), "00:00", "minutesToTime wraps 1440");
  assertEqual(minutesToTime(-1), "23:59", "minutesToTime wraps negative");
  assertEqual(clampNumber(5, 0, 3), 3, "clampNumber clamps high");
  assertEqual(clampNumber(-1, 0, 3), 0, "clampNumber clamps low");
  assertEqual(clampNumber(2, 0, 3), 2, "clampNumber passes through in range");
  assertEqual(liftBoundary(600, 540), 1980, "liftBoundary wraps when before start");
  assertEqual(liftBoundary(600, 660), 660, "liftBoundary keeps when after start");

  const wrapSettings = { dayStart: "18:00", dayEnd: "04:00" };
  const nonWrapSettings = { dayStart: "06:00", dayEnd: "23:00" };
  const fullDaySettings = { dayStart: "06:00", dayEnd: "06:00" };

  const jan15_0130 = new Date(2026, 0, 15, 1, 30);
  const jan15_1000 = new Date(2026, 0, 15, 10, 0);
  const jan15_1900 = new Date(2026, 0, 15, 19, 0);

  assertEqual(
    activeDayKey(jan15_0130, wrapSettings),
    "2026-01-14",
    "wrap: after midnight before dayEnd"
  );
  assertEqual(
    activeDayKey(jan15_1000, wrapSettings),
    "2026-01-15",
    "wrap: after dayEnd before dayStart"
  );
  assertEqual(
    activeDayKey(jan15_1900, wrapSettings),
    "2026-01-15",
    "wrap: after dayStart"
  );

  assertEqual(
    activeDayKey(jan15_0130, nonWrapSettings),
    "2026-01-15",
    "non-wrap: always today"
  );

  assertEqual(
    activeDayKey(jan15_0130, fullDaySettings),
    "2026-01-14",
    "full-day wrap: before dayEnd maps to yesterday"
  );
  assertEqual(
    activeDayKey(jan15_1900, fullDaySettings),
    "2026-01-15",
    "full-day wrap: after dayStart maps to today"
  );

  const key = dateToKey(new Date(2026, 0, 5, 9, 0));
  assertEqual(key, "2026-01-05", "dateToKey formats YYYY-MM-DD");
  const nextDay = addDaysLocal(new Date(2026, 0, 31, 9, 0), 1);
  assertEqual(dateToKey(nextDay), "2026-02-01", "addDaysLocal adds days safely");

  const boundaries = computeProtocolBoundaries({
    dayStart: "20:00",
    dayEnd: "04:00",
    ftnEnd: "19:00",
    lunchEnd: "03:00",
    dinnerEnd: "02:00"
  });
  assert(boundaries.end > boundaries.start, "protocol end is after start");
  assert(boundaries.start <= boundaries.ftnEnd, "ftn end not before start");
  assert(boundaries.ftnEnd <= boundaries.lunchEnd, "lunch end after ftn end");
  assert(boundaries.lunchEnd <= boundaries.dinnerEnd, "dinner end after lunch end");
  assert(boundaries.dinnerEnd <= boundaries.end, "dinner end not after end");
  const fullDay = computeProtocolBoundaries({
    dayStart: "06:00",
    dayEnd: "06:00",
    ftnEnd: "06:00",
    lunchEnd: "06:00",
    dinnerEnd: "06:00"
  });
  assertEqual(fullDay.end - fullDay.start, 1440, "full-day boundaries span 24h");

  const windows = computeSegmentWindows({
    dayStart: "20:00",
    dayEnd: "04:00",
    ftnEnd: "22:00",
    lunchEnd: "01:00",
    dinnerEnd: "03:30"
  });
  assertEqual(windows.length, 4, "segment windows count");
  for(let i = 0; i < windows.length; i++){
    const win = windows[i];
    assert(win.start <= win.end, `segment ${win.id} has non-negative width`);
    if(i > 0){
      assertEqual(win.start, windows[i - 1].end, `segment ${win.id} starts at prior end`);
    }
  }

  const sun = computeSunTimes(new Date(2026, 5, 21), 0, 0);
  assert(sun.status === "ok", "sun times ok at equator");
  assertBetween(sun.sunrise ?? -1, 0, 1439, "sunrise in range");
  assertBetween(sun.sunset ?? -1, 0, 1439, "sunset in range");
  assert((sun.sunrise ?? 0) < (sun.sunset ?? 0), "sunrise before sunset");
  const polarDay = computeSunTimes(new Date(2026, 5, 21), 85, 0);
  assert(polarDay.status === "polarDay", "polar day status");
  const polarNight = computeSunTimes(new Date(2026, 11, 21), 85, 0);
  assert(polarNight.status === "polarNight", "polar night status");

  const noonClamp = clampLocalTime(new Date(2026, 0, 15), 12 * 60 + 15);
  assert(noonClamp.clamped === false, "noon clamp no adjustment");
  assert(noonClamp.reason === "", "noon clamp no reason");
  assertBetween(noonClamp.minutes, 0, 1439, "noon clamp minutes in range");
  assert(Number.isFinite(noonClamp.offsetMinutes), "noon clamp has offset");

  const dstInfo = inspectDstClamp(new Date(2026, 0, 15), {
    dayStart: "06:00",
    dayEnd: "23:59",
    ftnEnd: "12:00",
    lunchEnd: "16:00",
    dinnerEnd: "21:00"
  });
  assert(dstInfo.applied === false, "dst inspect: no clamp expected");
  assert(dstInfo.ambiguous === false, "dst inspect: no ambiguity expected");
  assert(dstInfo.fields.length === 0, "dst inspect: no fields flagged");

  // DST gap clamp test (runs only if timezone can be set to America/New_York)
  if(!process.env.TZ){
    process.env.TZ = "America/New_York";
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if(tz === "America/New_York"){
    const dstDate = new Date(2026, 2, 8); // 2026-03-08 (US DST start)
    const clamp = clampLocalTime(dstDate, 2 * 60 + 30);
    assert(clamp.clamped === true, "DST gap clamps forward");
    assert(clamp.reason === "gap", "DST gap reason");
    assert(clamp.minutes >= 3 * 60, "DST gap clamps to >= 03:00");
  }else{
    console.log(`time tests: DST clamp skipped (timezone ${tz})`);
  }

  console.log("time tests: ok");
}

run();
