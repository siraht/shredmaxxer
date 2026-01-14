#!/usr/bin/env node
// @ts-check

import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

const ROOT = process.cwd();
const PORT = Number.parseInt(process.env.BROWSER_TEST_PORT || "5174", 10);
const FILTER = process.argv.find((arg) => arg.startsWith("--filter="))?.slice("--filter=".length) || "";
const HEADLESS = process.env.HEADLESS !== "false";

function logEvent(event){
  console.log(JSON.stringify(event));
}

async function ensureDir(dir){
  await fs.mkdir(dir, { recursive: true });
}

async function startServer(){
  const args = ["-m", "http.server", String(PORT), "--directory", ROOT];
  const proc = spawn("python3", args, { stdio: "ignore" });
  return proc;
}

async function wait(ms){
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(){
  let playwright;
  try{
    playwright = await import("playwright");
  }catch(e){
    console.error("Playwright not installed. See docs/testing-e2e-tooling.md");
    process.exit(1);
  }

  const server = await startServer();
  await wait(600);

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    try{
      const parsed = JSON.parse(text);
      if(parsed && parsed.event){
        logEvent(parsed);
        return;
      }
    }catch(e){
      // ignore
    }
    logEvent({ event: "browser_console", level: msg.type(), text });
  });

  const url = `http://localhost:${PORT}/tests/browser/index.html${FILTER ? `?filter=${encodeURIComponent(FILTER)}` : ""}`;
  logEvent({ event: "suite_start", url, ts: new Date().toISOString() });
  await page.goto(url, { waitUntil: "load" });

  let results;
  try{
    await page.waitForFunction(() => window.__TEST_DONE__ === true, { timeout: 60_000 });
    results = await page.evaluate(() => window.__TEST_RESULTS__ || null);
  }catch(err){
    const artifactDir = path.join(ROOT, "artifacts", "browser-tests");
    await ensureDir(artifactDir);
    const shot = path.join(artifactDir, `timeout-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    logEvent({ event: "suite_failure", reason: "timeout", screenshot: shot });
    await browser.close();
    server.kill();
    process.exit(1);
  }

  const failed = results && results.failed ? results.failed : 0;
  if(failed > 0){
    const artifactDir = path.join(ROOT, "artifacts", "browser-tests");
    await ensureDir(artifactDir);
    const shot = path.join(artifactDir, `failed-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    logEvent({ event: "suite_failure", reason: "test_failures", screenshot: shot });
  }

  logEvent({ event: "suite_end", results });
  await browser.close();
  server.kill();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  logEvent({ event: "suite_error", message: err?.message || String(err) });
  process.exit(1);
});
