// @ts-check

import { openSegment, closeSegment, selectChipByLabel, setSegmented } from "./helpers.mjs";

export async function run({ page, step, assert, helpers }){
  let todayKey = "";
  let yesterdayKey = "";

  await step("load app", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
    await page.waitForFunction(() => {
      const el = document.getElementById("datePicker");
      return el && el.value;
    });
    todayKey = await page.locator("#datePicker").inputValue();
  });

  await step("log yesterday lunch", async () => {
    await page.evaluate(() => {
      const btn = document.getElementById("prevDay");
      if(!btn) throw new Error("Missing prevDay");
      btn.click();
    });
    await page.waitForFunction((prev) => {
      const el = document.getElementById("datePicker");
      return el && el.value && el.value !== prev;
    }, todayKey);
    yesterdayKey = await page.locator("#datePicker").inputValue();
    await openSegment(page, "lunch");
    await selectChipByLabel(page, "#chipsProteins", "Beef");
    await selectChipByLabel(page, "#chipsCarbs", "White rice");
    await setSegmented(page, "#segStatus", "logged");
    await closeSegment(page);
  });

  await step("return to today", async () => {
    await page.evaluate(() => {
      const btn = document.getElementById("nextDay");
      if(!btn) throw new Error("Missing nextDay");
      btn.click();
    });
    await page.waitForFunction((key) => {
      const el = document.getElementById("datePicker");
      return el && el.value === key;
    }, todayKey);
  });

  await step("copy yesterday lunch into today", async () => {
    helpers.queueDialog("lunch");
    await page.waitForSelector("#copyYesterday:not([disabled])");
    await page.click("#copyYesterday");
  });

  await step("verify lunch copied", async () => {
    await page.waitForFunction(() => {
      const count = document.querySelector('.segment[data-segment="lunch"] .count[data-c="P"]');
      const seg = document.querySelector('.segment[data-segment="lunch"]');
      if(!count || !seg) return false;
      return count.textContent.trim() === "1" && seg.classList.contains("status-logged");
    }, { timeout: 2000 });
    const text = await page.locator('.segment[data-segment="lunch"] .count[data-c="P"]').innerText();
    assert(text.trim() === "1", "lunch protein count copied");
    const cls = await page.locator('.segment[data-segment="lunch"]').getAttribute("class");
    assert(cls && cls.includes("status-logged"), "lunch marked logged");
  });

  await step("log today FTN", async () => {
    await openSegment(page, "ftn");
    await setSegmented(page, "#segStatus", "logged");
    await selectChipByLabel(page, "#chipsProteins", "Eggs");
    await selectChipByLabel(page, "#chipsCarbs", "Fruit (whole)");
    await closeSegment(page);
  });

  await step("verify FTN counts", async () => {
    const p = await page.locator('.segment[data-segment="ftn"] .count[data-c="P"]').innerText();
    const c = await page.locator('.segment[data-segment="ftn"] .count[data-c="C"]').innerText();
    assert(p.trim() === "1", "ftn protein count 1");
    assert(c.trim() === "1", "ftn carb count 1");
    const cls = await page.locator('.segment[data-segment="ftn"]').getAttribute("class");
    assert(cls && cls.includes("status-logged"), "ftn marked logged");
  });

  await step("undo last change", async () => {
    await page.waitForSelector("#undoToast:not([hidden])");
    await page.click("#undoAction");
  });

  await step("verify last change reverted", async () => {
    await page.waitForFunction(() => {
      const c = document.querySelector('.segment[data-segment="ftn"] .count[data-c="C"]');
      return c && c.textContent.trim() === "";
    }, { timeout: 2000 });
    const p = await page.locator('.segment[data-segment="ftn"] .count[data-c="P"]').innerText();
    const c = await page.locator('.segment[data-segment="ftn"] .count[data-c="C"]').innerText();
    assert(p.trim() === "1", "ftn protein remains after undo");
    assert(c.trim() === "", "ftn carb cleared after undo");
  });

  return { status: "pass" };
}
