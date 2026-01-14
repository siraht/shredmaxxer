// @ts-check

import { createSafeModeGuards } from "./safe_mode.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

function createHarness({ safeMode }){
  let notified = 0;
  const guardActions = createSafeModeGuards({
    isSafeMode: () => safeMode,
    notify: () => { notified += 1; },
    allow: ["exportState"],
    blockedReturn: {
      applyImportPayload: { ok: false, error: "Safe Mode is active." },
      createSnapshot: () => Promise.reject(new Error("Safe Mode is active."))
    }
  });
  return { guardActions, getNotified: () => notified };
}

const actions = {
  canCopyYesterday: () => true,
  exportState: () => "exported",
  applyImportPayload: () => ({ ok: true }),
  createSnapshot: () => Promise.resolve("snap"),
  mutate: () => "mutated"
};

{
  const { guardActions, getNotified } = createHarness({ safeMode: true });
  const guarded = guardActions(actions);
  assert(guarded.canCopyYesterday() === false, "safe mode disables canCopyYesterday");
  assert(guarded.exportState() === "exported", "safe mode allows exportState");
  const importResult = guarded.applyImportPayload();
  assert(importResult && importResult.ok === false, "safe mode returns fallback for applyImportPayload");
  let rejected = false;
  await guarded.createSnapshot().catch(() => { rejected = true; });
  assert(rejected, "safe mode rejects createSnapshot");
  const blocked = guarded.mutate();
  assert(blocked === undefined, "safe mode blocks non-allow actions");
  assert(getNotified() === 1, "safe mode notifies once for blocked action");
}

{
  const { guardActions, getNotified } = createHarness({ safeMode: false });
  const guarded = guardActions(actions);
  assert(guarded.canCopyYesterday() === true, "normal mode preserves canCopyYesterday");
  assert(guarded.applyImportPayload().ok === true, "normal mode preserves applyImportPayload");
  const snap = await guarded.createSnapshot();
  assert(snap === "snap", "normal mode preserves createSnapshot");
  assert(guarded.mutate() === "mutated", "normal mode preserves mutate");
  assert(getNotified() === 0, "normal mode does not notify");
}

console.log("safe_mode tests: ok");
