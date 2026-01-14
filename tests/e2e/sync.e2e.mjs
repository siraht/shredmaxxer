// @ts-check

import { openSegment, closeSegment, selectChipByLabel, setSegmented, openTab } from "./helpers.mjs";

async function getSyncCreds(page){
  return page.evaluate(async () => {
    if(typeof indexedDB === "undefined") return null;
    return new Promise((resolve) => {
      const req = indexedDB.open("shredmaxx_solar_log");
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try{
          const db = req.result;
          const tx = db.transaction("sync_credentials", "readonly");
          const store = tx.objectStore("sync_credentials");
          const getReq = store.get("sync_credentials");
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        }catch(e){
          resolve(null);
        }
      };
    });
  });
}

async function waitForSyncCreds(page, timeoutMs = 8000){
  const end = Date.now() + timeoutMs;
  while(Date.now() < end){
    const creds = await getSyncCreds(page);
    if(creds && creds.spaceId) return creds;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

async function putRemoteItem(page, spaceId, key, payload){
  return page.evaluate(async ({ spaceId, key, payload }) => {
    const url = new URL(`/api/sync/v1/item/${encodeURIComponent(key)}`, window.location.origin);
    if(spaceId) url.searchParams.set("spaceId", spaceId);
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": "*" },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, status: res.status, etag: res.headers.get("ETag") || "" };
  }, { spaceId, key, payload });
}

export async function run({ page, step, assert, helpers, context }){
  await step("load app", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
  });

  await step("wait for initial sync status", async () => {
    await page.waitForSelector("#syncStatus");
    const text = await page.locator("#syncStatus").innerText();
    assert(text.length > 0, "sync status visible");
  });

  await step("seed remote data + pull once", async () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const creds = await waitForSyncCreds(page);
    assert(creds && creds.spaceId, "sync credentials available");
    const seed = await putRemoteItem(page, creds.spaceId, `logs/${dateKey}`, { hlc: "1:0:server", segments: { lunch: { proteins: [], carbs: [], fats: [], micros: [] } } });
    assert(seed.ok, "seed remote item ok");

    await openTab(page, "tabSettings");
    await page.click("#syncNowBtn");
    await page.waitForFunction(() => {
      const el = document.getElementById("syncStatus");
      return el && el.textContent && el.textContent.includes("Idle");
    }, { timeout: 8000 });
  });

  await step("log while offline", async () => {
    await context.setOffline(true);
    await openSegment(page, "lunch");
    await selectChipByLabel(page, "#chipsProteins", "Beef");
    await setSegmented(page, "#segStatus", "logged");
    await closeSegment(page);
  });

  await step("outbox shows pending", async () => {
    await page.waitForFunction(() => {
      const el = document.getElementById("syncStatus");
      return el && el.textContent && el.textContent.includes("•");
    }, { timeout: 5000 });
  });

  await step("back online and drain outbox", async () => {
    await context.setOffline(false);
    await page.waitForFunction(() => {
      const el = document.getElementById("syncStatus");
      if(!el || !el.textContent) return false;
      return !el.textContent.includes("•") && !el.textContent.toLowerCase().includes("offline");
    }, { timeout: 8000 });
  });

  await step("create conflict and verify snapshot", async () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const creds = await waitForSyncCreds(page);
    assert(creds && creds.spaceId, "sync credentials available (conflict)");
    const remoteUpdate = await putRemoteItem(page, creds.spaceId, `logs/${dateKey}`, { hlc: "2:0:server", segments: { lunch: { proteins: ["server"], carbs: [], fats: [], micros: [] } } });
    assert(remoteUpdate.ok, "remote update ok");

    await openSegment(page, "lunch");
    await selectChipByLabel(page, "#chipsProteins", "Lamb");
    await setSegmented(page, "#segStatus", "logged");
    await closeSegment(page);

    await openTab(page, "tabHistory");
    await page.waitForFunction(() => {
      const list = document.getElementById("snapshotList");
      return list && list.textContent && list.textContent.includes("Sync conflict");
    }, { timeout: 10000 });
  });

  return { status: "pass" };
}
