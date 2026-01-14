#!/usr/bin/env node
// @ts-check

import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

const ROOT = process.cwd();
const DEFAULT_DIRS = ["domain", "storage", "app"];
const SKIP_DIRS = new Set([".git", ".beads", ".codex", "node_modules", "fixtures", "icons", "assets", "docs", "ui"]);

const args = process.argv.slice(2);
let filter = "";
let dirs = DEFAULT_DIRS.slice();

for(const arg of args){
  if(arg.startsWith("--filter=")){
    filter = arg.slice("--filter=".length);
  }else if(arg.startsWith("--dirs=")){
    dirs = arg.slice("--dirs=".length).split(",").map(s => s.trim()).filter(Boolean);
  }
}

function logEvent(event){
  console.log(JSON.stringify(event));
}

async function pathExists(p){
  try{
    await fs.access(p);
    return true;
  }catch(e){
    return false;
  }
}

async function walk(dir, out){
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for(const entry of entries){
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()){
      if(SKIP_DIRS.has(entry.name)) continue;
      await walk(full, out);
    }else if(entry.isFile() && entry.name.endsWith(".test.mjs")){
      out.push(full);
    }
  }
}

async function findTests(){
  const tests = [];
  for(const d of dirs){
    const full = path.join(ROOT, d);
    if(!(await pathExists(full))) continue;
    await walk(full, tests);
  }
  const filtered = tests
    .map(p => path.relative(ROOT, p))
    .filter(p => !filter || p.includes(filter))
    .sort();
  return filtered;
}

function splitLines(chunk){
  return String(chunk).split(/\r?\n/).filter(Boolean);
}

async function runTest(file){
  const start = Date.now();
  logEvent({ event: "test_start", file, ts: new Date(start).toISOString() });

  const child = spawn(process.execPath, [file], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (buf) => {
    const text = String(buf);
    stdout += text;
    for(const line of splitLines(text)){
      logEvent({ event: "test_output", file, stream: "stdout", line });
    }
  });

  child.stderr.on("data", (buf) => {
    const text = String(buf);
    stderr += text;
    for(const line of splitLines(text)){
      logEvent({ event: "test_output", file, stream: "stderr", line });
    }
  });

  const code = await new Promise((resolve) => {
    child.on("close", resolve);
  });

  const durationMs = Date.now() - start;
  const stdoutLower = stdout.toLowerCase();
  const isSkipped = stdoutLower.includes("skipped");
  const status = (code === 0)
    ? (isSkipped ? "skip" : "pass")
    : "fail";

  logEvent({
    event: "test_result",
    file,
    status,
    exit_code: code,
    duration_ms: durationMs
  });

  if(code !== 0){
    logEvent({ event: "test_failure", file, status, stderr });
  }

  return { status, code };
}

async function main(){
  const start = Date.now();
  const tests = await findTests();

  logEvent({ event: "suite_start", ts: new Date(start).toISOString(), test_count: tests.length, filter, dirs });

  if(tests.length === 0){
    logEvent({ event: "suite_empty", message: "No tests found" });
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for(const file of tests){
    const res = await runTest(file);
    if(res.status === "pass") passed += 1;
    else if(res.status === "skip") skipped += 1;
    else failed += 1;

    if(res.code !== 0){
      logEvent({ event: "suite_abort", reason: "test_failure", file });
      break;
    }
  }

  const durationMs = Date.now() - start;
  logEvent({
    event: "suite_end",
    duration_ms: durationMs,
    passed,
    failed,
    skipped,
    total: tests.length
  });

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  logEvent({ event: "suite_error", message: err?.message || String(err) });
  process.exit(1);
});
