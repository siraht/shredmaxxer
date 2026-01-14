// @ts-check

import { activeDayKey } from "./time.js";

function assertEqual(actual, expected, label){
  if(actual !== expected){
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function run(){
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

  console.log("time tests: ok");
}

run();
