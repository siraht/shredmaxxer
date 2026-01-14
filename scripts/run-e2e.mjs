#!/usr/bin/env node
// @ts-check

import { spawn } from "child_process";
import fs from "fs/promises";
import net from "net";
import path from "path";
import { pathToFileURL } from "url";
import http from "http";

const ROOT = process.cwd();
const PORT = Number.parseInt(process.env.E2E_PORT || "5175", 10);
const HEADLESS = process.env.HEADLESS !== "false";
const FILTER = process.argv.find((arg) => arg.startsWith("--filter="))?.slice("--filter=".length) || "";
const TEST_DIR = path.join(ROOT, "tests", "e2e");
const ARTIFACT_ROOT = path.join(ROOT, "artifacts", "e2e");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_DIR = path.join(ARTIFACT_ROOT, "logs");
let LOG_FILE = "";

function logHuman(message){
  process.stderr.write(`[e2e] ${message}\n`);
}

function logEvent(event){
  const record = {
    run_id: RUN_ID,
    ts: event.ts || new Date().toISOString(),
    ...event
  };
  const line = JSON.stringify(record);
  console.log(line);
  if(LOG_FILE){
    void fs.appendFile(LOG_FILE, `${line}\n`).catch(() => {});
  }
}

async function ensureDir(dir){
  await fs.mkdir(dir, { recursive: true });
}

async function initLogFile(){
  await ensureDir(LOG_DIR);
  LOG_FILE = path.join(LOG_DIR, `run-${RUN_ID}.jsonl`);
  await fs.writeFile(LOG_FILE, "");
  logEvent({ event: "log_ready", path: LOG_FILE });
}

async function startServer(){
  const args = ["-m", "http.server", String(PORT), "--directory", ROOT];
  const proc = spawn("python3", args, { stdio: "ignore" });
  return proc;
}

async function wait(ms){
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPortAvailable(port){
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      if(err && err.code === "EADDRINUSE"){
        resolve(false);
      }else{
        resolve(false);
      }
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function waitForServer(baseUrl, { timeoutMs = 5000, intervalMs = 200 } = {}){
  const end = Date.now() + timeoutMs;
  const target = new URL(baseUrl);

  while(Date.now() < end){
    const ok = await new Promise((resolve) => {
      const req = http.get(target, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode >= 200);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if(ok) return true;
    await wait(intervalMs);
  }
  return false;
}

async function findTests(){
  const entries = await fs.readdir(TEST_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".e2e.mjs"))
    .map((entry) => path.join(TEST_DIR, entry.name))
    .filter((file) => !FILTER || file.includes(FILTER))
    .sort();
}

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

function createStepLogger(testName){
  return async (label, fn) => {
    const start = Date.now();
    logEvent({ event: "step_start", test: testName, label, ts: new Date(start).toISOString() });
    try{
      const result = await fn();
      logEvent({ event: "step_end", test: testName, label, duration_ms: Date.now() - start });
      return result;
    }catch(err){
      logEvent({
        event: "step_error",
        test: testName,
        label,
        duration_ms: Date.now() - start,
        message: err?.message || String(err)
      });
      throw err;
    }
  };
}

async function runTest({ browser, file, baseUrl }){
  const name = path.basename(file, ".e2e.mjs");
  const testStart = Date.now();
  logEvent({ event: "test_start", name, file, ts: new Date(testStart).toISOString() });

  const videoDir = path.join(ARTIFACT_ROOT, "videos", name);
  await ensureDir(videoDir);

  const context = await browser.newContext({
    acceptDownloads: true,
    recordVideo: { dir: videoDir }
  });
  const page = await context.newPage();
  const dialogQueue = [];
  await context.tracing.start({ screenshots: true, snapshots: true });

  page.on("console", (msg) => {
    logEvent({ event: "browser_console", test: name, level: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    logEvent({ event: "browser_error", test: name, message: err?.message || String(err) });
  });
  page.on("dialog", async (dialog) => {
    const message = dialog.message();
    const type = dialog.type();
    logEvent({ event: "browser_dialog", test: name, dialog_type: type, message });
    const next = dialogQueue.length ? dialogQueue.shift() : undefined;
    if(type === "prompt"){
      await dialog.accept(typeof next === "string" ? next : "");
      return;
    }
    if(type === "confirm"){
      if(next === false){
        await dialog.dismiss();
      }else{
        await dialog.accept();
      }
      return;
    }
    await dialog.accept();
  });

  const step = createStepLogger(name);
  const helpers = {
    baseUrl,
    queueDialog(value){
      dialogQueue.push(value);
    },
    async goto(pathname = "/"){
      const target = new URL(pathname, baseUrl).toString();
      await page.goto(target, { waitUntil: "load" });
    },
    async resetStorage({ keepServiceWorker = false, keepCaches = false } = {}){
      await page.goto(baseUrl, { waitUntil: "load" });
      await page.evaluate(async ({ keepServiceWorker, keepCaches }) => {
        try{
          localStorage.clear();
        }catch(e){
          // ignore
        }
        if(!keepCaches && "caches" in window){
          try{
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }catch(e){
            // ignore
          }
        }
        if(!keepServiceWorker && "serviceWorker" in navigator){
          try{
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((reg) => reg.unregister()));
          }catch(e){
            // ignore
          }
        }
        if(typeof indexedDB !== "undefined"){
          const deleteDb = (name) => new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = () => resolve(null);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
          });
          try{
            if(typeof indexedDB.databases === "function"){
              const dbs = await indexedDB.databases();
              await Promise.all(dbs.map((db) => deleteDb(db.name)));
            }else{
              await deleteDb("shredmaxx_solar_log");
            }
          }catch(e){
            // ignore
          }
        }
      }, { keepServiceWorker, keepCaches });
      await page.reload({ waitUntil: "load" });
    }
  };

  const videoRef = page.video();
  let videoPath = "";
  let status = "pass";
  let skipReason = "";
  let failure = null;

  try{
    const modUrl = pathToFileURL(file).toString();
    const mod = await import(modUrl);
    if(typeof mod.run !== "function"){
      throw new Error(`Missing run() in ${file}`);
    }
    const result = await mod.run({
      page,
      context,
      step,
      assert,
      helpers,
      baseUrl,
      logEvent
    });
    if(result && result.status === "skip"){
      status = "skip";
      skipReason = result.reason || "";
    }
  }catch(err){
    status = "fail";
    failure = err;
  }

  if(status === "fail"){
    const shotDir = path.join(ARTIFACT_ROOT, "screenshots");
    await ensureDir(shotDir);
    const shot = path.join(shotDir, `${name}-${Date.now()}.png`);
    try{
      await page.screenshot({ path: shot, fullPage: true });
      logEvent({ event: "artifact", test: name, kind: "screenshot", path: shot });
    }catch(e){
      // ignore
    }
    try{
      const traceDir = path.join(ARTIFACT_ROOT, "traces");
      await ensureDir(traceDir);
      const tracePath = path.join(traceDir, `${name}-${Date.now()}.zip`);
      await context.tracing.stop({ path: tracePath });
      logEvent({ event: "artifact", test: name, kind: "trace", path: tracePath });
    }catch(e){
      // ignore
    }
  }else{
    try{
      await context.tracing.stop();
    }catch(e){
      // ignore
    }
  }

  await context.close();
  try{
    if(videoRef){
      videoPath = await videoRef.path();
    }
  }catch(e){
    // ignore
  }

  const durationMs = Date.now() - testStart;
  logEvent({
    event: "test_result",
    name,
    file,
    status,
    duration_ms: durationMs,
    video: videoPath || undefined,
    reason: skipReason || undefined
  });

  if(status === "fail"){
    logEvent({
      event: "test_failure",
      name,
      file,
      message: failure?.message || String(failure)
    });
    throw failure;
  }

  return { status };
}

async function main(){
  let playwright;
  try{
    playwright = await import("playwright");
  }catch(err){
    console.error("Playwright not installed. See docs/testing-e2e-tooling.md");
    process.exit(1);
  }

  await ensureDir(ARTIFACT_ROOT);
  await initLogFile();
  logHuman(`Run ${RUN_ID} starting on port ${PORT} (headless=${HEADLESS})`);

  const portOk = await isPortAvailable(PORT);
  if(!portOk){
    logEvent({ event: "suite_error", message: `Port ${PORT} is already in use.` });
    logHuman(`Port ${PORT} already in use. Set E2E_PORT or free the port.`);
    process.exit(1);
  }

  const server = await startServer();
  logEvent({ event: "server_start", port: PORT });
  const baseUrl = `http://localhost:${PORT}/`;
  const ready = await waitForServer(baseUrl, { timeoutMs: 8000, intervalMs: 250 });
  if(!ready){
    logEvent({ event: "server_error", message: "Server did not become ready in time." });
    logHuman("Server did not become ready in time.");
    server.kill();
    process.exit(1);
  }
  logEvent({ event: "server_ready", url: baseUrl });
  let shuttingDown = false;
  const shutdown = (code, reason) => {
    if(shuttingDown) return;
    shuttingDown = true;
    logEvent({ event: "suite_abort", reason: reason || "signal" });
    try{
      server.kill();
    }catch(e){
      // ignore
    }
    process.exit(code);
  };
  process.on("SIGINT", () => shutdown(130, "SIGINT"));
  process.on("SIGTERM", () => shutdown(143, "SIGTERM"));

  const tests = await findTests();
  logEvent({ event: "suite_start", ts: new Date().toISOString(), test_count: tests.length, filter: FILTER });
  logHuman(`Found ${tests.length} e2e tests${FILTER ? ` (filter=${FILTER})` : ""}.`);

  if(tests.length === 0){
    logEvent({ event: "suite_empty", message: "No e2e tests found" });
    server.kill();
    process.exit(1);
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: HEADLESS });

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  try{
    for(const file of tests){
      try{
        const res = await runTest({ browser, file, baseUrl });
        if(res.status === "skip") skipped += 1;
        else passed += 1;
      }catch(err){
        failed += 1;
        logEvent({ event: "suite_abort", reason: "test_failure", file });
        break;
      }
    }
  }finally{
    await browser.close();
    server.kill();
  }

  logEvent({
    event: "suite_end",
    ts: new Date().toISOString(),
    passed,
    failed,
    skipped,
    total: tests.length
  });
  logHuman(`Suite complete: ${passed} passed, ${failed} failed, ${skipped} skipped.`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  logEvent({ event: "suite_error", message: err?.message || String(err) });
  process.exit(1);
});
