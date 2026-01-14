// @ts-check

import { openSegment, closeSegment, openTab, selectChipByLabel, setSegmented } from "./helpers.mjs";

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

  await step("log today and yesterday", async () => {
    await openSegment(page, "ftn");
    await selectChipByLabel(page, "#chipsProteins", "Beef");
    await selectChipByLabel(page, "#chipsCarbs", "Honey");
    await setSegmented(page, "#segStatus", "logged");
    await closeSegment(page);

    await page.fill("#datePicker", yesterdayKey);
    await page.dispatchEvent("#datePicker", "change");
    await openSegment(page, "lunch");
    await selectChipByLabel(page, "#chipsProteins", "Lamb");
    await selectChipByLabel(page, "#chipsCarbs", "Potatoes");
    await setSegmented(page, "#segStatus", "logged");
    await closeSegment(page);

    await page.fill("#datePicker", todayKey);
    await page.dispatchEvent("#datePicker", "change");
  });

  await step("open review tab", async () => {
    await openTab(page, "tabReview");
    await page.waitForSelector("#coverageMatrix .matrix-row");
  });

  await step("verify review range and matrix", async () => {
    const range = await page.locator("#reviewRange").innerText();
    assert(range.includes("—") === false, "review range populated");
    const todayRow = page.locator(`#coverageMatrix .matrix-row[data-date="${todayKey}"]`);
    const yesterdayRow = page.locator(`#coverageMatrix .matrix-row[data-date="${yesterdayKey}"]`);
    const todayCount = await todayRow.count();
    const yesterdayCount = await yesterdayRow.count();
    assert(todayCount + yesterdayCount >= 1, "matrix row for logged day exists");
  });

  await step("verify summary and rotation picks", async () => {
    const summary = await page.locator("#reviewSummary").innerText();
    assert(summary.includes("Unique"), "review summary includes unique counts");
    const picks = await page.locator("#rotationPicks .pick-row").count();
    assert(picks > 0, "rotation picks render");
    const labelText = await page.locator("#rotationPicks").innerText();
    assert(labelText.includes("Try:"), "rotation picks include try label");
  });

  await step("verify correlations block", async () => {
    const text = await page.locator("#reviewCorrelations").innerText();
    assert(text.trim().length > 0, "correlations block populated");
  });

  await step("matrix cell opens segment", async () => {
    const todayRow = page.locator(`#coverageMatrix .matrix-row[data-date="${todayKey}"]`);
    const useToday = (await todayRow.count()) > 0;
    const rowKey = useToday ? todayKey : yesterdayKey;
    const cell = page.locator(`#coverageMatrix .matrix-row[data-date="${rowKey}"] .matrix-cell[data-col="proteins"]`).first();
    await cell.click();
    await page.waitForSelector("#sheet:not(.hidden)");
    const title = await page.locator("#sheetTitle").innerText();
    assert(title.toLowerCase().includes("ftn") || title.toLowerCase().includes("lunch"), "opening proteins cell opens a segment");
  });

  return { status: "pass" };
}
