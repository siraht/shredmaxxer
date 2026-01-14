// @ts-check

import fs from "fs/promises";
import { openTab, openSegment, closeSegment, selectChipByLabel, setSegmented } from "./helpers.mjs";

async function openDetails(page, label){
  await page.evaluate((summaryLabel) => {
    const panels = Array.from(document.querySelectorAll("details"));
    const panel = panels.find((el) => (el.querySelector("summary")?.textContent || "").includes(summaryLabel));
    if(panel) panel.open = true;
  }, label);
}

async function readDownloadJson(download){
  const filePath = await download.path();
  if(!filePath){
    throw new Error("Download path unavailable");
  }
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function readDownloadText(download){
  const filePath = await download.path();
  if(!filePath){
    throw new Error("Download path unavailable");
  }
  return fs.readFile(filePath, "utf8");
}

export async function run({ page, step, assert, helpers }){
  await step("load app", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
  });

  await step("create data for export", async () => {
    await openSegment(page, "lunch");
    await selectChipByLabel(page, "#chipsProteins", "Lamb");
    await selectChipByLabel(page, "#chipsCarbs", "Potatoes");
    await setSegmented(page, "#segStatus", "logged");
    await closeSegment(page);
  });

  await step("export JSON", async () => {
    await openTab(page, "tabHistory");
    await openDetails(page, "Backup + Import");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#exportBtn")
    ]);
    const payload = await readDownloadJson(download);
    assert(payload && payload.version === 4, "plain export is v4");
    assert(payload.logs && typeof payload.logs === "object", "plain export includes logs");
  });

  await step("export encrypted JSON", async () => {
    helpers.queueDialog("pass123");
    helpers.queueDialog("pass123");
    await openDetails(page, "Backup + Import");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#exportAltBtn")
    ]);
    const payload = await readDownloadJson(download);
    assert(payload.type === "shredmaxx:encrypted", "encrypted export type matches");
    assert(payload.version === 1, "encrypted export version 1");
  });

  await step("export CSV", async () => {
    await openDetails(page, "Backup + Import");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#exportCsvBtn")
    ]);
    const text = await readDownloadText(download);
    assert(text.startsWith("date,phase,energy"), "csv export has header row");
    assert(text.includes("ftn_proteins"), "csv export includes segment columns");
  });

  await step("import plain export (merge)", async () => {
    await openDetails(page, "Backup + Import");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#exportBtn")
    ]);
    const filePath = await download.path();
    if(!filePath) throw new Error("Download path unavailable for import");
    await page.setInputFiles("#importFile", filePath);
    await page.waitForSelector("#importApply:not([disabled])");
    await page.click("#importApply");
    await page.waitForFunction(() => {
      const el = document.getElementById("importStatus");
      return el && el.textContent && el.textContent.includes("Import merge complete");
    });
    const status = await page.locator("#importStatus").innerText();
    assert(status.includes("Import merge complete"), "merge import status reported");
  });

  await step("import encrypted export (replace)", async () => {
    helpers.queueDialog("pass123");
    helpers.queueDialog("pass123");
    helpers.queueDialog("pass123");
    await openDetails(page, "Backup + Import");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#exportAltBtn")
    ]);
    const filePath = await download.path();
    if(!filePath) throw new Error("Encrypted download path unavailable for import");
    await page.click('#importMode .seg-btn[data-value="replace"]');
    await page.setInputFiles("#importFile", filePath);
    await page.waitForSelector("#importApply:not([disabled])");
    helpers.queueDialog(true);
    await page.click("#importApply");
    await page.waitForFunction(() => {
      const el = document.getElementById("importStatus");
      return el && el.textContent && el.textContent.includes("Import replace complete");
    });
    const status = await page.locator("#importStatus").innerText();
    assert(status.includes("Import replace complete"), "replace import status reported");
  });

  await step("verify imported data in UI", async () => {
    await openTab(page, "tabToday");
    const p = await page.locator('.segment[data-segment="lunch"] .count[data-c="P"]').innerText();
    assert(p.trim() === "1", "imported lunch protein count present");
  });

  await step("verify snapshot count", async () => {
    await openDetails(page, "Diagnostics");
    await page.waitForFunction(() => {
      const el = document.getElementById("diagSnapshotCount");
      return el && /\d+/.test(el.textContent || "");
    });
    const countText = await page.locator("#diagSnapshotCount").innerText();
    const count = Number.parseInt(countText, 10);
    assert(Number.isFinite(count) && count >= 1, "snapshot count updated");
  });

  return { status: "pass" };
}
