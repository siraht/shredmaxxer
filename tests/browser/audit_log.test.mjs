// @ts-check

import { appendAuditEvent, listAuditEvents } from "../../storage/audit_log.js";
import { storageAdapter } from "../../storage/adapter.js";

export async function run({ logEvent, assert }){
  logEvent({ event: "audit_log_start" });

  const initial = await listAuditEvents({ adapter: storageAdapter });
  assert(Array.isArray(initial) && initial.length === 0, "audit log starts empty");

  const now = new Date("2026-01-14T12:00:00Z");
  await appendAuditEvent({ type: "sync", message: "first", now }, { adapter: storageAdapter });
  await appendAuditEvent({ type: "sync", message: "second", now: new Date("2026-01-14T12:01:00Z") }, { adapter: storageAdapter });

  const list = await listAuditEvents({ adapter: storageAdapter });
  assert(list.length === 2, "audit log stores entries");
  assert(list[0].message === "first", "audit log preserves order");
  assert(list[1].message === "second", "audit log preserves order 2");

  await appendAuditEvent({ type: "sync", message: "third", now: new Date("2026-01-14T12:02:00Z") }, { adapter: storageAdapter, max: 2 });
  const trimmed = await listAuditEvents({ adapter: storageAdapter });
  assert(trimmed.length === 2, "audit log trims to max");
  assert(trimmed[0].message === "second", "audit log trimmed oldest");
  assert(trimmed[1].message === "third", "audit log kept newest");

  logEvent({ event: "audit_log_done" });
  return { status: "pass" };
}
