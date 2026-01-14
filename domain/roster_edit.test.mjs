// @ts-check

import { setRosterLabel, setRosterAliases, setRosterTags, toggleRosterPinned, toggleRosterArchived } from "./roster_edit.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const base = {
  id: "1",
  label: "Beef",
  aliases: ["steak"],
  tags: ["protein"],
  pinned: false,
  archived: false,
  tsCreated: "2026-01-01T00:00:00.000Z",
  tsUpdated: "2026-01-01T00:00:00.000Z"
};

const now = new Date("2026-01-02T00:00:00.000Z");
const labeled = setRosterLabel(base, "  Beef  ", now);
assert(labeled.label === "Beef", "label normalized");
assert(labeled.tsUpdated === now.toISOString(), "label updates tsUpdated");

const aliases = setRosterAliases(base, ["Steak", "steak", ""], now);
assert(aliases.aliases.length === 1 && aliases.aliases[0] === "Steak", "aliases dedupe + trim");

const tags = setRosterTags(base, ["carb", "Carb", ""], now);
assert(tags.tags.length === 1 && tags.tags[0] === "carb", "tags dedupe + trim");

const pinned = toggleRosterPinned(base, now);
assert(pinned.pinned === true, "toggle pinned");
const unpinned = toggleRosterPinned(pinned, now);
assert(unpinned.pinned === false, "toggle pinned twice");

const archived = toggleRosterArchived(base, now);
assert(archived.archived === true, "toggle archived");
const unarchived = toggleRosterArchived(archived, now);
assert(unarchived.archived === false, "toggle archived twice");

console.log("roster edit tests: ok");
