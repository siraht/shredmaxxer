// @ts-check

import {
  createRosterItem,
  dedupeRosterByLabel,
  findRosterItemByLabel,
  generateId,
  isUniqueLabel,
  labelKey,
  normalizeLabel,
  updateRosterLabel
} from "./roster.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

assert(normalizeLabel("  Beef   steak ") === "Beef steak", "normalizeLabel trims/collapses");
assert(labelKey("  Beef  ") === "beef", "labelKey lowercases");

const item = createRosterItem(" Beef ", { now: new Date("2026-01-01T00:00:00Z") });
assert(!!item.id, "createRosterItem creates id");
assert(item.label === "Beef", "createRosterItem normalizes label");
assert(item.tsCreated === "2026-01-01T00:00:00.000Z", "createRosterItem tsCreated set");
assert(item.tsUpdated === "2026-01-01T00:00:00.000Z", "createRosterItem tsUpdated set");

const updated = updateRosterLabel(item, "  New   Label ", new Date("2026-01-02T00:00:00Z"));
assert(updated.label === "New Label", "updateRosterLabel normalizes");
assert(updated.tsUpdated === "2026-01-02T00:00:00.000Z", "updateRosterLabel updates ts");

const items = [
  { id: "1", label: "Beef" },
  { id: "2", label: "beef" },
  { id: "3", label: "Chicken" }
];
const found = findRosterItemByLabel(items, "BEEF");
assert(found && found.id === "1", "findRosterItemByLabel case-insensitive");
assert(isUniqueLabel(items, "Fish"), "isUniqueLabel true when unique");
assert(!isUniqueLabel(items, "beef"), "isUniqueLabel false when duplicate");

const deduped = dedupeRosterByLabel(items);
assert(deduped.items.length === 2, "dedupeRosterByLabel removes duplicate labels");
assert(deduped.duplicates.length === 1, "dedupeRosterByLabel records duplicate");

const withEmpty = [
  { id: "1", label: "" },
  { id: "2", label: "" }
];
const emptyDeduped = dedupeRosterByLabel(withEmpty);
assert(emptyDeduped.items.length === 2, "dedupe keeps empty labels distinct");

const merged = dedupeRosterByLabel(items, (kept, incoming) => ({ ...kept, merged: true, id: kept.id, label: kept.label, incomingId: incoming.id }));
assert(merged.items.some((it) => it.merged), "dedupe onDuplicate can merge");

const id = generateId();
assert(typeof id === "string" && id.length >= 8, "generateId returns string");

console.log("roster tests: ok");
