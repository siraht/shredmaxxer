// @ts-check

import { createRosterItem, normalizeLabel } from "./roster.js";

const BASE_ROSTERS = {
  proteins: [
    { label: "Beef" },
    { label: "Bison" },
    { label: "Lamb" },
    { label: "Elk/Venison" },
    { label: "Shrimp" },
    { label: "Scallops" },
    { label: "Whitefish (cod/halibut)" },
    { label: "Fatty fish (sardines/oysters)" },
    { label: "Eggs" },
    { label: "Non-fat dairy" },
    { label: "Collagen/Gelatin" }
  ],
  carbs: [
    { label: "Fruit (whole)", tags: ["carb:fruit"] },
    { label: "Fruit juice", tags: ["carb:fruit"] },
    { label: "Honey", tags: ["carb:sugar"] },
    { label: "White rice", tags: ["carb:starch"] },
    { label: "Rice noodles", tags: ["carb:starch"] },
    { label: "Potatoes", tags: ["carb:starch"] },
    { label: "Sweet potatoes", tags: ["carb:starch"] },
    { label: "Sprouted oats", tags: ["carb:starch"] },
    { label: "Sourdough", tags: ["carb:starch"] }
  ],
  fats: [
    { label: "Coconut oil", tags: ["fat:dense"] },
    { label: "MCT oil", tags: ["fat:dense"] },
    { label: "Tallow / stearic", tags: ["fat:dense"] },
    { label: "Butter / ghee", tags: ["fat:dense"] },
    { label: "Cocoa butter", tags: ["fat:dense"] },
    { label: "Egg yolks" },
    { label: "Raw cheese" },
    { label: "Olive oil (sparingly)" },
    { label: "Avocado" }
  ],
  micros: [
    { label: "Garlic" },
    { label: "Red onion" },
    { label: "Ginger" },
    { label: "Rosemary" },
    { label: "Thyme" },
    { label: "Basil / holy basil" },
    { label: "Cayenne" },
    { label: "Parsley" },
    { label: "Cilantro" },
    { label: "Arugula (bitter greens)" },
    { label: "Seaweed" }
  ]
};

/**
 * Create the default v4 rosters with conservative tags.
 * @param {Date} [now]
 * @returns {{proteins:any[], carbs:any[], fats:any[], micros:any[]}}
 */
export function createDefaultRosters(now){
  const at = now instanceof Date ? now : new Date();
  return {
    proteins: BASE_ROSTERS.proteins.map((item) => createRosterItem(item.label, { tags: item.tags || [], now: at })),
    carbs: BASE_ROSTERS.carbs.map((item) => createRosterItem(item.label, { tags: item.tags || [], now: at })),
    fats: BASE_ROSTERS.fats.map((item) => createRosterItem(item.label, { tags: item.tags || [], now: at })),
    micros: BASE_ROSTERS.micros.map((item) => createRosterItem(item.label, { tags: item.tags || [], now: at }))
  };
}

/**
 * Find a default roster item template by label.
 * @param {"proteins"|"carbs"|"fats"|"micros"} category
 * @param {string} label
 * @returns {{label:string, tags?:string[]} | null}
 */
export function findDefaultRosterTemplate(category, label){
  const list = BASE_ROSTERS[category] || [];
  const key = normalizeLabel(label).toLowerCase();
  if(!key) return null;
  return list.find((item) => normalizeLabel(item.label).toLowerCase() === key) || null;
}

export { BASE_ROSTERS };

export {};
