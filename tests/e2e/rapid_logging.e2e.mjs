// @ts-check

import { openSegment, closeSegment, selectChipByLabel, setSegmented } from "./helpers.mjs";

async function setLoggedWithItems(page, segId, protein, carb){
  await openSegment(page, segId);
  if(protein){
    await selectChipByLabel(page, "#chipsProteins", protein);
  }
  if(carb){
    await selectChipByLabel(page, "#chipsCarbs", carb);
  }
  await setSegmented(page, "#segStatus", "logged");
  await closeSegment(page);
}

export async function run({ page, step, assert, helpers }){
  await step("load app", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
  });

  await step("reset storage", async () => {
    await helpers.resetStorage();
    await page.waitForSelector(".segment");
  });

  await step("rapid log across segments", async () => {
    await setLoggedWithItems(page, "ftn", "Eggs", "Fruit (whole)");
    await setLoggedWithItems(page, "lunch", "Beef", "White rice");
    await setLoggedWithItems(page, "dinner", "Lamb", "Potatoes");
  });

  await step("verify segment status and counts", async () => {
    const ftnClass = await page.locator('.segment[data-segment="ftn"]').getAttribute("class");
    const lunchClass = await page.locator('.segment[data-segment="lunch"]').getAttribute("class");
    const dinnerClass = await page.locator('.segment[data-segment="dinner"]').getAttribute("class");
    assert(ftnClass && ftnClass.includes("status-logged"), "ftn marked logged");
    assert(lunchClass && lunchClass.includes("status-logged"), "lunch marked logged");
    assert(dinnerClass && dinnerClass.includes("status-logged"), "dinner marked logged");

    const ftnP = await page.locator('.segment[data-segment="ftn"] .count[data-c="P"]').innerText();
    const lunchC = await page.locator('.segment[data-segment="lunch"] .count[data-c="C"]').innerText();
    const dinnerP = await page.locator('.segment[data-segment="dinner"] .count[data-c="P"]').innerText();
    assert(ftnP.trim() === "1", "ftn protein count 1");
    assert(lunchC.trim() === "1", "lunch carb count 1");
    assert(dinnerP.trim() === "1", "dinner protein count 1");
  });

  return { status: "pass" };
}
