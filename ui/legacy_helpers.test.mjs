// @ts-check

import {
  countIssues,
  collectMissingRosterItems,
  dayHasDailyContent,
  formatLatLon,
  formatSnapshotTime,
  mergeDayDiversity,
  parseCommaList,
  parseCopySegments,
  segCounts,
  segmentHasContent
} from "./legacy_helpers.js";
import { createDefaultDay } from "../app/helpers.js";
import { createDefaultRosters } from "../domain/roster_defaults.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

{
  const parsed = parseCopySegments("all");
  assert(parsed.includeDaily, "parseCopySegments all includes daily");
  assert(parsed.segments.length === 4, "parseCopySegments all segments");
}

{
  const parsed = parseCopySegments("ftn, dinner lunch");
  assert(!parsed.includeDaily, "parseCopySegments list excludes daily");
  assert(parsed.segments.join(",") === "ftn,dinner,lunch", "parseCopySegments preserves order without dupes");
}

{
  const day = createDefaultDay();
  day.segments.ftn.proteins = ["a", "b"];
  day.segments.lunch.proteins = ["b", "c"];
  const merged = mergeDayDiversity(day);
  assert(merged.proteins === 3, "mergeDayDiversity counts unique items");
}

{
  const seg = createDefaultDay().segments.ftn;
  seg.proteins.push("p1");
  const counts = segCounts(seg);
  assert(counts.P === 1 && counts.C === 0, "segCounts counts category lengths");
  assert(segmentHasContent(seg, "ftn"), "segmentHasContent detects items");
}

{
  const counts = segCounts({});
  assert(counts.P === 0 && counts.C === 0 && counts.F === 0 && counts.M === 0, "segCounts handles missing arrays");
  assert(!segmentHasContent({}, "ftn"), "segmentHasContent handles missing arrays");
}

{
  const seg = createDefaultDay().segments.ftn;
  seg.ftnMode = "strict";
  assert(segmentHasContent(seg, "ftn"), "segmentHasContent detects ftn mode");
}

{
  const day = createDefaultDay();
  assert(!dayHasDailyContent(day), "dayHasDailyContent false on empty day");
  day.mood = "3";
  assert(dayHasDailyContent(day), "dayHasDailyContent true when daily fields set");
}

{
  const rosters = createDefaultRosters(new Date("2026-01-01T00:00:00.000Z"));
  const day = createDefaultDay();
  day.segments.lunch.collision = "yes";
  day.segments.lunch.highFatMeal = "yes";
  day.segments.lunch.seedOil = "yes";
  const issues = countIssues(day, rosters);
  assert(issues.collision && issues.highFat && issues.seedOil, "countIssues detects issue flags");
}

{
  const rosters = {
    proteins: [{ id: "p1", label: "Beef" }],
    carbs: [],
    fats: [],
    micros: [],
    supplements: [{ id: "s1", label: "Magnesium" }]
  };
  const logs = {
    "2026-01-02": {
      segments: {
        lunch: { proteins: ["p1", "p2"], carbs: ["c1"], fats: [], micros: [] }
      },
      supplements: { items: ["s1", "s2"] }
    }
  };
  const missing = collectMissingRosterItems(rosters, logs);
  assert(missing.size === 3, "collectMissingRosterItems finds all missing ids");
  assert(missing.get("p2") === "proteins", "missing protein id mapped to category");
  assert(missing.get("c1") === "carbs", "missing carb id mapped to category");
  assert(missing.get("s2") === "supplements", "missing supplement id mapped to category");
}

{
  assert(formatLatLon(34, -118) === "34.0000, -118.0000", "formatLatLon formats to 4dp");
  assert(formatLatLon(null, 0) === "", "formatLatLon handles invalid numbers");
}

{
  const list = parseCommaList("a, b, c");
  assert(list.length === 3 && list[1] === "b", "parseCommaList splits by comma");
}

{
  const invalid = formatSnapshotTime("not-a-date");
  assert(invalid === "not-a-date", "formatSnapshotTime returns input for invalid date");
  const rendered = formatSnapshotTime("2026-01-01T00:00:00.000Z");
  assert(typeof rendered === "string" && rendered.length > 0, "formatSnapshotTime returns a string for valid date");
}

console.log("legacy helpers tests: ok");
