// @ts-check

import { buildTagIndex, computeCollisionAuto, computeHighFatMealAuto, computeSeedOilHint, computeSegmentFlags, resolveTri } from "./flags.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const rosters = {
  carbs: [
    { id: "c1", tags: ["carb:starch"] },
    { id: "c2", tags: ["carb:fruit"] }
  ],
  fats: [
    { id: "f1", tags: ["fat:dense"] },
    { id: "f2", tags: ["fat:seed_oil"] },
    { id: "f3", tags: ["fat:unknown"] }
  ]
};

const tagIndex = buildTagIndex(rosters);

const seg = { carbs: ["c1"], fats: ["f1"] };
assert(computeCollisionAuto(seg, tagIndex) === true, "collision auto true for dense fat + starch");
assert(computeHighFatMealAuto(seg, tagIndex) === true, "high-fat auto true for dense fat");
assert(computeSeedOilHint(seg, tagIndex) === false, "seed oil hint false without seed oil tag");

const seg2 = { carbs: ["c2"], fats: ["f2"] };
assert(computeCollisionAuto(seg2, tagIndex) === false, "no collision for fruit + seed oil");
assert(computeSeedOilHint(seg2, tagIndex) === true, "seed oil hint true for seed oil tag");

const segUnknown = { carbs: ["c2"], fats: ["f3"] };
assert(computeSeedOilHint(segUnknown, tagIndex) === true, "seed oil hint true for unknown oil tag");

const seg3 = { carbs: ["c1"], fats: [] };
assert(computeCollisionAuto(seg3, tagIndex) === false, "collision false without fat");
assert(computeHighFatMealAuto(seg3, tagIndex) === false, "high-fat false without dense fat");

const seg4 = { carbs: ["c1"], fats: ["f1"], collision: "no", highFatMeal: "yes" };
const flags = computeSegmentFlags(seg4, tagIndex);
assert(flags.collisionEffective === "no", "collision override no");
assert(flags.highFatMealEffective === "yes", "high-fat override yes");

assert(resolveTri("yes", false) === "yes", "override yes wins");
assert(resolveTri("no", true) === "no", "override no wins");
assert(resolveTri("", true) === "yes", "auto uses computed value");

console.log("flags tests: ok");
