// @ts-check

import { openSegment, closeSegment, openTab, selectChipByLabel, setSegmented } from "./helpers.mjs";

export async function run({ page, step, assert, helpers }){
  const errors = [];
  page.on("console", (msg) => {
    if(msg.type() === "error"){
      errors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    errors.push(err?.message || String(err));
  });

  await step("load app", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
  });

  await step("log dinner and verify counts", async () => {
    await openSegment(page, "dinner");
    await selectChipByLabel(page, "#chipsProteins", "Bison");
    await selectChipByLabel(page, "#chipsCarbs", "Rice noodles");
    await setSegmented(page, "#segStatus", "logged");
    await closeSegment(page);
    const p = await page.locator('.segment[data-segment="dinner"] .count[data-c="P"]').innerText();
    assert(p.trim() === "1", "dinner protein count 1");
  });

  await step("reload and confirm persistence", async () => {
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".segment");
    const p = await page.locator('.segment[data-segment="dinner"] .count[data-c="P"]').innerText();
    assert(p.trim() === "1", "dinner protein count persisted");
  });

  await step("check diagnostics fields", async () => {
    await openTab(page, "tabHistory");
    await page.waitForFunction(() => {
      const mode = document.getElementById("diagStorageMode");
      return mode && mode.textContent && mode.textContent !== "—";
    });
    const storageMode = await page.locator("#diagStorageMode").innerText();
    const persist = await page.locator("#diagPersistStatus").innerText();
    const schema = await page.locator("#diagSchemaVersion").innerText();
    const appVersion = await page.locator("#diagAppVersion").innerText();
    assert(storageMode.length > 0, "storage mode populated");
    assert(schema.length > 0, "schema version populated");
    assert(appVersion.length > 0, "app version populated");
    assert(persist.length > 0, "persist status populated");
  });

  await step("create snapshot and verify count", async () => {
    const beforeText = await page.locator("#diagSnapshotCount").innerText();
    const before = Number.parseInt(beforeText, 10);
    const startCount = Number.isFinite(before) ? before : 0;
    await page.click("#snapshotCreate");
    await page.waitForFunction((prev) => {
      const el = document.getElementById("diagSnapshotCount");
      if(!el) return false;
      const value = Number.parseInt(el.textContent || "", 10);
      return Number.isFinite(value) && value > prev;
    }, startCount);
    const countText = await page.locator("#diagSnapshotCount").innerText();
    const count = Number.parseInt(countText, 10);
    assert(Number.isFinite(count) && count > startCount, "snapshot count incremented");
  });

  await step("verify no console errors", async () => {
    assert(errors.length === 0, `no console errors (got ${errors.length})`);
  });

  return { status: "pass" };
}
