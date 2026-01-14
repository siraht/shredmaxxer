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
assert(scoreMatch("be", "beef") === 3, "scoreMatch startsWith higher score");
assert(scoreMatch("ef", "beef") === 1, "scoreMatch includes lower score");

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

const emptyAll = searchRosterItems(items, "", { includeArchived: true });
assert(emptyAll.length === 3, "empty query includes archived when allowed");

const multiToken = searchRosterItems(items, "beef steak");
assert(multiToken.length === 1 && multiToken[0].label === "Beef", "multi-token query matches aliases");

const limited = searchRosterItems(items, "bee", { limit: 1 });
assert(limited.length === 1, "limit reduces results");

console.log("search tests: ok");
