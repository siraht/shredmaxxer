// @ts-check

import { createSnapshotRecord, planSnapshotPrune, serializeSnapshotPayload, sortSnapshotsNewest } from "./snapshots.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const state = { version: 4 };
const payload = serializeSnapshotPayload(state, new Date("2026-01-01T12:00:00Z"));
assert(payload.includes("\"exportedAt\""), "snapshot payload includes exportedAt");

const record = createSnapshotRecord({ state, label: "Manual", now: new Date("2026-01-01T12:00:00Z") });
assert(record.id.length > 10, "snapshot id generated");
assert(record.label === "Manual", "snapshot label set");

const list = [
  { id: "a", ts: "2026-01-01T10:00:00Z" },
  { id: "b", ts: "2026-01-02T10:00:00Z" },
  { id: "c", ts: "2026-01-03T10:00:00Z" }
];
const sorted = sortSnapshotsNewest(list);
assert(sorted[0].id === "c", "sorted newest first");
assert(sorted[2].id === "a", "sorted oldest last");

const pruned = planSnapshotPrune(list, 2);
assert(pruned.keep.length === 2, "prune keeps max");
assert(pruned.remove.length === 1, "prune removes extras");

console.log("snapshots tests: ok");
