// @ts-check

import { searchRosterItems, scoreMatch } from "./search.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const items = [
  { label: "Beef", aliases: ["Beef steak"], archived: false },
  { label: "Bee pollen", aliases: [], archived: false },
  { label: "Chicken", aliases: ["Poultry"], archived: true }
];

assert(scoreMatch("bee", "Beef") > 0, "scoreMatch matches case-insensitive");
assert(scoreMatch("bee", "Chicken") === 0, "scoreMatch rejects non-matches");

const beeResults = searchRosterItems(items, "bee");
assert(beeResults.length === 2, "search returns matches");
assert(beeResults[0].label === "Bee pollen", "ties break by label sort");

const aliasResults = searchRosterItems(items, "poul");
assert(aliasResults.length === 0, "archived excluded by default");

const aliasResultsAll = searchRosterItems(items, "poul", { includeArchived: true });
assert(aliasResultsAll.length === 1 && aliasResultsAll[0].label === "Chicken", "aliases search works when archived allowed");

const emptyQuery = searchRosterItems(items, "");
assert(emptyQuery.length === 2, "empty query returns non-archived items");
assert(emptyQuery[0].label === "Bee pollen", "empty query sorts by label");

console.log("search tests: ok");
