// @ts-check

import { openTab } from "./helpers.mjs";

function formatDate(date){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minutesToTime(minutes){
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export async function run({ page, step, assert, helpers }){
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dayEnd = (nowMinutes + 60) % 1440;
  const dayStart = (nowMinutes + 120) % 1440;
  const ftnEnd = (dayStart + 240) % 1440;
  const lunchEnd = (ftnEnd + 180) % 1440;
  const dinnerEnd = (lunchEnd + 240) % 1440;
  const todayKey = formatDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = formatDate(yesterday);
  const expectedActive = nowMinutes < dayEnd ? yesterdayKey : todayKey;
  const otherKey = expectedActive === todayKey ? yesterdayKey : todayKey;

  await step("load app", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
  });

  await step("set wrap-around time model", async () => {
    await openTab(page, "tabSettings");
    await page.fill("#setDayStart", minutesToTime(dayStart));
    await page.fill("#setDayEnd", minutesToTime(dayEnd));
    await page.fill("#setFtnEnd", minutesToTime(ftnEnd));
    await page.fill("#setLunchEnd", minutesToTime(lunchEnd));
    await page.fill("#setDinnerEnd", minutesToTime(dinnerEnd));
    await page.click("#saveSettings");
  });

  await step("verify settings persist", async () => {
    await page.reload({ waitUntil: "load" });
    await openTab(page, "tabSettings");
    const startVal = await page.locator("#setDayStart").inputValue();
    const endVal = await page.locator("#setDayEnd").inputValue();
    assert(startVal === minutesToTime(dayStart), "dayStart persisted");
    assert(endVal === minutesToTime(dayEnd), "dayEnd persisted");
  });

  await step("verify segment ordering + ranges", async () => {
    await openTab(page, "tabToday");
    const order = await page.$$eval(".segment", (els) => els.map((el) => el.dataset.segment || ""));
    assert(order.join(",") === "ftn,lunch,dinner,late", "segment order is ftn,lunch,dinner,late");
    const ftnRange = await page.locator('.segment[data-segment="ftn"] .segment-time').innerText();
    const lateRange = await page.locator('.segment[data-segment="late"] .segment-time').innerText();
    assert(ftnRange.includes("–"), "ftn range rendered");
    assert(lateRange.includes("–"), "late range rendered");
    assert(ftnRange.startsWith(minutesToTime(dayStart)), "ftn range starts at dayStart");
    assert(lateRange.endsWith(minutesToTime(dayEnd)), "late range ends at dayEnd");
  });

  await step("verify active day marker for wrap-around", async () => {
    await page.fill("#datePicker", expectedActive);
    await page.dispatchEvent("#datePicker", "change");
    await page.waitForTimeout(150);
    const activeDisplay = await page.locator("#nowMarker").evaluate((el) => getComputedStyle(el).display);
    assert(activeDisplay !== "none", "now marker visible for active day");

    await page.fill("#datePicker", otherKey);
    await page.dispatchEvent("#datePicker", "change");
    await page.waitForTimeout(150);
    const inactiveDisplay = await page.locator("#nowMarker").evaluate((el) => getComputedStyle(el).display);
    assert(inactiveDisplay === "none", "now marker hidden for non-active day");
  });

  return { status: "pass" };
}
