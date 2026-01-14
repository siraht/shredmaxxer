// @ts-check

import { openSegment, closeSegment, openTab } from "./helpers.mjs";

export async function run({ page, step, assert, helpers }){
  await step("load app", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
  });

  await step("add protein from sheet", async () => {
    await openSegment(page, "ftn");
    helpers.queueDialog("Test Protein");
    await page.click("#addProtein");
    await page.waitForTimeout(200);
    const chip = page.locator("#chipsProteins .chip", { hasText: "Test Protein" }).first();
    await chip.click();
    const classes = await chip.getAttribute("class");
    assert(classes && classes.includes("active"), "new protein chip is active");
    await closeSegment(page);
  });

  await step("edit roster aliases", async () => {
    await openTab(page, "tabSettings");
    const item = page.locator("#roster-proteins .roster-item").filter({
      has: page.locator('input[data-field="label"][value="Test Protein"]')
    }).first();
    await item.waitFor();
    const aliases = item.locator('input[data-field="aliases"]');
    await aliases.fill("TP");
    await page.waitForTimeout(400);
  });

  await step("edit roster tags and persist", async () => {
    const item = page.locator("#roster-proteins .roster-item").filter({
      has: page.locator('input[data-field="label"][value="Test Protein"]')
    }).first();
    const tags = item.locator('input[data-field="tags"]');
    await tags.fill("protein:test, roster");
    await page.waitForTimeout(400);

    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".segment");
    await openTab(page, "tabSettings");
    const reloaded = page.locator("#roster-proteins .roster-item").filter({
      has: page.locator('input[data-field="label"][value="Test Protein"]')
    }).first();
    await reloaded.waitFor();
    const tagValue = await reloaded.locator('input[data-field="tags"]').inputValue();
    assert(tagValue.includes("protein:test"), "tags persisted after reload");
  });

  await step("search by alias in sheet", async () => {
    await openTab(page, "tabToday");
    await openSegment(page, "ftn");
    await page.fill("#searchProteins", "TP");
    await page.waitForTimeout(200);
    const chip = page.locator("#chipsProteins .chip", { hasText: "Test Protein" }).first();
    const count = await chip.count();
    assert(count === 1, "alias search shows the new protein");
    await closeSegment(page);
  });

  await step("pin and archive roster item", async () => {
    await openTab(page, "tabSettings");
    const row = page.locator("#roster-proteins .roster-item").filter({
      has: page.locator('input[data-field="label"][value="Test Protein"]')
    }).first();
    const pinBtn = row.locator('button[data-action="pin"]');
    await pinBtn.click();
    await page.waitForFunction(() => {
      const input = document.querySelector('#roster-proteins input[data-field="label"][value="Test Protein"]');
      const item = input ? input.closest(".roster-item") : null;
      const btn = item ? item.querySelector('button[data-action="pin"]') : null;
      return !!(btn && btn.classList.contains("active"));
    });
    const firstLabel = page.locator("#roster-proteins .roster-item input[data-field=\"label\"]").first();
    await page.waitForFunction(() => {
      const el = document.querySelector("#roster-proteins .roster-item input[data-field=\"label\"]");
      return el && el.value === "Test Protein";
    });
    const firstValue = await firstLabel.inputValue();
    assert(firstValue === "Test Protein", "pinned item sorted to top");
    const archiveBtn = row.locator('button[data-action="archive"]');
    await archiveBtn.click();
    await page.waitForFunction(() => {
      const input = document.querySelector('#roster-proteins input[data-field="label"][value="Test Protein"]');
      const item = input ? input.closest(".roster-item") : null;
      return !!(item && item.classList.contains("archived"));
    });
  });

  await step("archived item hidden in chips", async () => {
    await openTab(page, "tabToday");
    await openSegment(page, "ftn");
    await page.fill("#searchProteins", "");
    const chipCount = await page.locator("#chipsProteins .chip", { hasText: "Test Protein" }).count();
    assert(chipCount === 0, "archived item hidden from chips");
    await closeSegment(page);
  });

  await step("remove roster item", async () => {
    await openTab(page, "tabSettings");
    const row = page.locator("#roster-proteins .roster-item").filter({
      has: page.locator('input[data-field="label"][value="Test Protein"]')
    }).first();
    await row.waitFor();
    await row.locator('button[data-action="remove"]').click();
    await page.waitForTimeout(200);
    const count = await page.locator("#roster-proteins .roster-item", { hasText: "Test Protein" }).count();
    assert(count === 0, "roster item removed");
  });

  return { status: "pass" };
}
