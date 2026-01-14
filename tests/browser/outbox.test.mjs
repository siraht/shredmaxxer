// @ts-check

import { enqueueOutbox, loadOutbox, removeOutboxOp, updateOutboxOp } from "../../storage/outbox.js";
import { storageAdapter } from "../../storage/adapter.js";

export async function run({ logEvent, assert }){
  if(typeof indexedDB === "undefined"){
    return { status: "skip", reason: "IndexedDB not available" };
  }

  logEvent({ event: "outbox_start" });

  await storageAdapter.saveOutbox([]);
  const initial = await loadOutbox();
  assert(Array.isArray(initial) && initial.length === 0, "outbox starts empty");

  const op1 = { id: "op-1", key: "logs/2026-01-01", method: "PUT", payload: { foo: 1 }, ts: new Date().toISOString(), attempts: 0 };
  const op2 = { id: "op-2", key: "logs/2026-01-02", method: "PUT", payload: { foo: 2 }, ts: new Date().toISOString(), attempts: 0 };
  const op1b = { id: "op-3", key: "logs/2026-01-01", method: "PUT", payload: { foo: 3 }, ts: new Date().toISOString(), attempts: 0 };

  await enqueueOutbox(op1);
  await enqueueOutbox(op2);
  let list = await loadOutbox();
  assert(list.length === 2, "outbox stores multiple keys");

  await enqueueOutbox(op1b);
  list = await loadOutbox();
  assert(list.length === 2, "outbox coalesces by key");
  const updated = list.find((entry) => entry.key === "logs/2026-01-01");
  assert(updated && updated.id === "op-3", "outbox keeps latest op for key");

  await updateOutboxOp("op-3", (entry) => ({ ...entry, attempts: (entry.attempts || 0) + 1 }));
  list = await loadOutbox();
  const bumped = list.find((entry) => entry.id === "op-3");
  assert(bumped && bumped.attempts === 1, "outbox update increments attempts");

  await removeOutboxOp("op-2");
  list = await loadOutbox();
  assert(list.length === 1 && list[0].id === "op-3", "outbox remove deletes op");

  logEvent({ event: "outbox_done" });
  return { status: "pass" };
}
