// @ts-check

import { storageAdapter } from "./adapter.js";

/**
 * @typedef {{
 *  id: string,
 *  key: string,
 *  method: "PUT"|"DELETE",
 *  payload?: any,
 *  etag?: string,
 *  hlc?: string,
 *  actor?: string,
 *  ts: string,
 *  attempts: number,
 *  lastError?: string
 * }} OutboxOp
 */

/**
 * @returns {Promise<OutboxOp[]>}
 */
export async function loadOutbox(){
  try{
    const adapter = storageAdapter;
    const list = await adapter.getOutbox?.();
    return Array.isArray(list) ? list : [];
  }catch(e){
    return [];
  }
}

/**
 * @param {OutboxOp[]} list
 */
export async function saveOutbox(list){
  const safe = Array.isArray(list) ? list : [];
  const adapter = storageAdapter;
  if(typeof adapter.saveOutbox === "function"){
    await adapter.saveOutbox(safe);
  }
}

/**
 * Enqueue an op and coalesce by key (latest wins).
 * @param {OutboxOp} op
 * @returns {Promise<OutboxOp[]>}
 */
export async function enqueueOutbox(op){
  const list = await loadOutbox();
  const next = [];
  let replaced = false;
  for(const entry of list){
    if(entry && entry.key === op.key){
      if(!replaced){
        next.push(op);
        replaced = true;
      }
      continue;
    }
    next.push(entry);
  }
  if(!replaced){
    next.push(op);
  }
  await saveOutbox(next);
  return next;
}

/**
 * @param {string} opId
 * @returns {Promise<OutboxOp[]>}
 */
export async function removeOutboxOp(opId){
  const list = await loadOutbox();
  const next = list.filter((entry) => entry && entry.id !== opId);
  await saveOutbox(next);
  return next;
}

/**
 * Update an existing op.
 * @param {string} opId
 * @param {(op:OutboxOp)=>OutboxOp} mut
 * @returns {Promise<OutboxOp[]>}
 */
export async function updateOutboxOp(opId, mut){
  const list = await loadOutbox();
  const next = list.map((entry) => {
    if(!entry || entry.id !== opId) return entry;
    return mut(entry);
  });
  await saveOutbox(next);
  return next;
}

export {};
