#!/usr/bin/env node
// @ts-check

import fs from "fs/promises";
import net from "net";
import path from "path";
import { pathToFileURL } from "url";
import { startTestServer } from "./test_server.mjs";

const ROOT = process.cwd();
const PORT = Number.parseInt(process.env.E2E_PORT || "5175", 10);
const HEADLESS = process.env.HEADLESS !== "false";
const FILTER = process.argv.find((arg) => arg.startsWith("--filter="))?.slice("--filter=".length) || "";
const TEST_DIR = path.join(ROOT, "tests", "e2e");
const ARTIFACT_ROOT = path.join(ROOT, "artifacts", "e2e");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const RUN_DIR = path.join(ARTIFACT_ROOT, "runs", RUN_ID);
const LOG_DIR = path.join(RUN_DIR, "logs");
let LOG_FILE = "";
let EVENT_SEQ = 0;
const EVENT_SCHEMA = "e2e-event-v1";
const RUN_MANIFEST = {
  schema_version: "e2e-manifest-v1",
  run_id: RUN_ID,
  root: RUN_DIR,
  started_at: new Date().toISOString(),
  ended_at: "",
  env: {
    node: process.version,
    platform: process.platform,
    arch: process.arch
  },
  config: {
    port: PORT,
    headless: HEADLESS,
    filter: FILTER
  },
  server: {
    base_url: "",
    ready: false
  },
  tests: [],
  totals: {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0
  },
  artifacts: []
};

function logHuman(message){
  process.stderr.write(`[e2e] ${message}\n`);
}

function logEvent(event){
  const record = {
    seq: EVENT_SEQ++,
    schema: EVENT_SCHEMA,
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

async function writeManifest(){
  const manifestPath = path.join(RUN_DIR, "manifest.json");
  await ensureDir(RUN_DIR);
  await fs.writeFile(manifestPath, JSON.stringify(RUN_MANIFEST, null, 2));
  logEvent({ event: "manifest_write", path: manifestPath });
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

function createStepLogger(testName, onStep){
  return async (label, fn) => {
    const start = Date.now();
    logEvent({ event: "step_start", test: testName, label, ts: new Date(start).toISOString() });
    if(typeof onStep === "function"){
      onStep({ label, event: "start", ts: new Date(start).toISOString() });
    }
    try{
      const result = await fn();
      const durationMs = Date.now() - start;
      logEvent({ event: "step_end", test: testName, label, duration_ms: durationMs });
      if(typeof onStep === "function"){
        onStep({ label, event: "end", duration_ms: durationMs });
      }
      return result;
    }catch(err){
      const durationMs = Date.now() - start;
      logEvent({
        event: "step_error",
        test: testName,
        label,
        duration_ms: durationMs,
        message: err?.message || String(err)
      });
      if(typeof onStep === "function"){
        onStep({ label, event: "error", duration_ms: durationMs, message: err?.message || String(err) });
      }
      throw err;
    }
  };
}

async function runTest({ browser, file, baseUrl }){
  const name = path.basename(file, ".e2e.mjs");
  const testStart = Date.now();
  logEvent({ event: "test_start", name, file, ts: new Date(testStart).toISOString() });
  const testManifest = {
    name,
    file,
    started_at: new Date(testStart).toISOString(),
    ended_at: "",
    status: "running",
    artifacts: [],
    steps: []
  };

  const videoDir = path.join(RUN_DIR, "videos", name);
  await ensureDir(videoDir);

  const modUrl = pathToFileURL(file).toString();
  const mod = await import(modUrl);
  if(typeof mod.run !== "function"){
    throw new Error(`Missing run() in ${file}`);
  }
  const serviceWorkers = mod.e2eConfig?.serviceWorkers || "block";
  const context = await browser.newContext({
    acceptDownloads: true,
    recordVideo: { dir: videoDir },
    serviceWorkers
  });
  const page = await context.newPage();
  const dialogQueue = [];
  await context.tracing.start({ screenshots: true, snapshots: true });

  page.on("console", (msg) => {
    logEvent({
      event: "browser_console",
      test: name,
      level: msg.type(),
      text: msg.text()
    });
  });
  page.on("pageerror", (err) => {
    logEvent({ event: "browser_error", test: name, message: err?.message || String(err) });
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure();
    logEvent({
      event: "http_request_failed",
      test: name,
      url: req.url(),
      method: req.method(),
      failure: failure?.errorText || "unknown"
    });
  });
  page.on("response", (res) => {
    if(res.ok()) return;
    logEvent({
      event: "http_response_error",
      test: name,
      url: res.url(),
      status: res.status(),
      status_text: res.statusText()
    });
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

  const step = createStepLogger(name, (entry) => {
    testManifest.steps.push(entry);
  });
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
    const result = await mod.run({
      page,
      context,
      step,
      assert,
      helpers,
      baseUrl,
      logEvent,
      recordStep(label, meta = {}){
        testManifest.steps.push({
          label,
          ts: new Date().toISOString(),
          ...meta
        });
      }
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
    const shotDir = path.join(RUN_DIR, "screenshots");
    await ensureDir(shotDir);
    const shot = path.join(shotDir, `${name}-${Date.now()}.png`);
    try{
      await page.screenshot({ path: shot, fullPage: true });
      logEvent({ event: "artifact", test: name, kind: "screenshot", path: shot });
      testManifest.artifacts.push({ kind: "screenshot", path: shot });
      RUN_MANIFEST.artifacts.push({ test: name, kind: "screenshot", path: shot });
    }catch(e){
      // ignore
    }
    try{
      const traceDir = path.join(RUN_DIR, "traces");
      await ensureDir(traceDir);
      const tracePath = path.join(traceDir, `${name}-${Date.now()}.zip`);
      await context.tracing.stop({ path: tracePath });
      logEvent({ event: "artifact", test: name, kind: "trace", path: tracePath });
      testManifest.artifacts.push({ kind: "trace", path: tracePath });
      RUN_MANIFEST.artifacts.push({ test: name, kind: "trace", path: tracePath });
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

  if(videoPath){
    logEvent({ event: "artifact", test: name, kind: "video", path: videoPath });
    testManifest.artifacts.push({ kind: "video", path: videoPath });
    RUN_MANIFEST.artifacts.push({ test: name, kind: "video", path: videoPath });
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
  testManifest.status = status;
  testManifest.ended_at = new Date().toISOString();
  testManifest.duration_ms = durationMs;
  if(skipReason){
    testManifest.skip_reason = skipReason;
  }
  RUN_MANIFEST.tests.push(testManifest);

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
  await ensureDir(RUN_DIR);
  await initLogFile();
  logHuman(`Run ${RUN_ID} starting on port ${PORT} (headless=${HEADLESS})`);

  const portOk = await isPortAvailable(PORT);
  if(!portOk){
    logEvent({ event: "suite_error", message: `Port ${PORT} is already in use.` });
    logHuman(`Port ${PORT} already in use. Set E2E_PORT or free the port.`);
    process.exit(1);
  }

  const { server, baseUrl } = await startTestServer({ port: PORT, root: ROOT });
  logEvent({ event: "server_start", port: PORT });
  logEvent({ event: "server_ready", url: baseUrl });
  RUN_MANIFEST.server.base_url = baseUrl;
  RUN_MANIFEST.server.ready = true;
  let shuttingDown = false;
  const shutdown = (code, reason) => {
    if(shuttingDown) return;
    shuttingDown = true;
    logEvent({ event: "suite_abort", reason: reason || "signal" });
    try{
      server.close();
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
  RUN_MANIFEST.totals.total = tests.length;

  if(tests.length === 0){
    logEvent({ event: "suite_empty", message: "No e2e tests found" });
    server.close();
    process.exit(1);
  }

  const { chromium } = playwright;
  RUN_MANIFEST.env.browser = {
    name: "chromium",
    version: typeof chromium.version === "function" ? chromium.version() : "unknown"
  };
  logEvent({
    event: "suite_env",
    node: RUN_MANIFEST.env.node,
    platform: RUN_MANIFEST.env.platform,
    arch: RUN_MANIFEST.env.arch,
    browser: RUN_MANIFEST.env.browser
  });
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
    server.close();
  }

  logEvent({
    event: "suite_end",
    ts: new Date().toISOString(),
    passed,
    failed,
    skipped,
    total: tests.length
  });
  RUN_MANIFEST.totals = { passed, failed, skipped, total: tests.length };
  RUN_MANIFEST.ended_at = new Date().toISOString();
  await writeManifest();
  logHuman(`Suite complete: ${passed} passed, ${failed} failed, ${skipped} skipped.`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  logEvent({ event: "suite_error", message: err?.message || String(err) });
  process.exit(1);
});
