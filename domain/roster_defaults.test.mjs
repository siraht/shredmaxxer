// @ts-check

import { createDefaultRosters, findDefaultRosterTemplate } from "./roster_defaults.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const rosters = createDefaultRosters(new Date("2026-01-01T00:00:00Z"));
const cats = ["proteins", "carbs", "fats", "micros", "supplements"];

for(const cat of cats){
  const list = rosters[cat];
  assert(Array.isArray(list), `roster ${cat} is array`);
  const ids = new Set();
  for(const item of list){
    assert(item && typeof item.label === "string" && item.label.length > 0, `${cat} label non-empty`);
    assert(typeof item.id === "string" && item.id.length > 0, `${cat} id set`);
    assert(Array.isArray(item.tags), `${cat} tags array`);
    assert(!ids.has(item.id), `${cat} ids unique`);
    ids.add(item.id);
  }
}

const found = findDefaultRosterTemplate("carbs", "  white   rice ");
assert(found && found.label.toLowerCase().includes("white"), "findDefaultRosterTemplate normalizes label");
const missing = findDefaultRosterTemplate("proteins", "Not Real");
assert(missing === null, "findDefaultRosterTemplate returns null for missing");

console.log("roster defaults tests: ok");
