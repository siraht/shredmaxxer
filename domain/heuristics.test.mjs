// @ts-check

import { effectiveHighFatDay, effectiveSegmentFlags, normalizeTri } from "./heuristics.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const rosters = {
  carbs: [{ id: "c1", tags: ["carb:starch"] }],
  fats: [{ id: "f1", tags: ["fat:dense"] }, { id: "f2", tags: ["fat:seed_oil"] }],
  proteins: [],
  micros: []
};

assert(normalizeTri(true) === "yes", "normalizeTri(true)");
assert(normalizeTri(false) === "no", "normalizeTri(false)");
assert(normalizeTri("") === "auto", "normalizeTri('')");
assert(normalizeTri("auto") === "auto", "normalizeTri('auto')");
assert(normalizeTri(null) === "auto", "normalizeTri null");
assert(normalizeTri("maybe") === "auto", "normalizeTri invalid -> auto");

const seg = {
  carbs: ["c1"],
  fats: ["f1"],
  collision: "auto",
  highFatMeal: "auto"
};

const flags = effectiveSegmentFlags(seg, rosters);
assert(flags.collision.value === true, "collision auto true");
assert(flags.collision.source === "auto", "collision source auto");
assert(flags.highFatMeal.value === true, "high-fat auto true");
assert(flags.highFatMeal.source === "auto", "high-fat source auto");
assert(flags.seedOilHint === false, "seed oil hint false");

const overrideSeg = {
  carbs: ["c1"],
  fats: ["f2"],
  collision: "no",
  highFatMeal: "yes"
};
const overrideFlags = effectiveSegmentFlags(overrideSeg, rosters);
assert(overrideFlags.collision.value === false, "collision override no");
assert(overrideFlags.collision.source === "no", "collision source no");
assert(overrideFlags.highFatMeal.value === true, "high-fat override yes");
assert(overrideFlags.highFatMeal.source === "yes", "high-fat source yes");
assert(overrideFlags.seedOilHint === true, "seed oil hint true");

const emptyOverride = {
  carbs: ["c1"],
  fats: ["f1"],
  collision: "",
  highFatMeal: ""
};
const emptyFlags = effectiveSegmentFlags(emptyOverride, rosters);
assert(emptyFlags.collision.source === "auto", "empty collision uses auto");
assert(emptyFlags.highFatMeal.source === "auto", "empty high-fat uses auto");

const dayAuto = {
  highFatDay: "auto",
  segments: {
    ftn: { carbs: [], fats: [], collision: "auto", highFatMeal: "auto" },
    lunch: { carbs: [], fats: ["f1"], collision: "auto", highFatMeal: "auto" },
    dinner: { carbs: [], fats: [], collision: "auto", highFatMeal: "auto" },
    late: { carbs: [], fats: [], collision: "auto", highFatMeal: "auto" }
  }
};
const autoHighFat = effectiveHighFatDay(dayAuto, rosters);
assert(autoHighFat.value === true, "auto highFatDay true when high-fat meal exists");
assert(autoHighFat.source === "auto", "auto highFatDay source auto");

const dayNo = { ...dayAuto, highFatDay: "no" };
const noHighFat = effectiveHighFatDay(dayNo, rosters);
assert(noHighFat.value === false, "override highFatDay no");
assert(noHighFat.source === "no", "override highFatDay source no");

console.log("heuristics tests: ok");
