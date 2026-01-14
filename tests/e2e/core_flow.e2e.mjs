// @ts-check

import { openSegment, closeSegment, selectChipByLabel, setSegmented } from "./helpers.mjs";

function formatDate(date){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function run({ page, step, assert, helpers }){
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const todayKey = formatDate(today);
  const yesterdayKey = formatDate(yesterday);

  await step("load app", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
  });

  await step("log yesterday lunch", async () => {
    await page.click("#prevDay");
    await page.waitForFunction((key) => {
      const el = document.getElementById("datePicker");
      return el && el.value === key;
    }, yesterdayKey);
    await openSegment(page, "lunch");
    await selectChipByLabel(page, "#chipsProteins", "Beef");
    await selectChipByLabel(page, "#chipsCarbs", "White rice");
    await setSegmented(page, "#segStatus", "logged");
    await closeSegment(page);
  });

  await step("return to today", async () => {
    await page.click("#nextDay");
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
    const p = await page.locator('.segment[data-segment="ftn"] .count[data-c="P"]').innerText();
    const c = await page.locator('.segment[data-segment="ftn"] .count[data-c="C"]').innerText();
    assert(p.trim() === "1", "ftn protein remains after undo");
    assert(c.trim() === "", "ftn carb cleared after undo");
  });

  return { status: "pass" };
}
