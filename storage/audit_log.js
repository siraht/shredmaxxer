// @ts-check

import { storageAdapter } from "./adapter.js";

const MAX_AUDIT_EVENTS = 200;

function generateId(){
  if(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"){
    return crypto.randomUUID();
  }
  const now = Date.now();
  const rand = Math.floor(Math.random() * 1e6);
  return `audit-${now}-${rand}`;
}

/**
 * @param {{type?:string, message?:string, level?:string, detail?:any, now?:Date}} params
 * @returns {{id:string, ts:string, type:string, level:"info"|"warn"|"error", message:string, detail?:any}}
 */
export function createAuditEvent(params){
  const now = params?.now instanceof Date ? params.now : new Date();
  const level = (params?.level === "warn" || params?.level === "error") ? params.level : "info";
  return {
    id: generateId(),
    ts: now.toISOString(),
    type: typeof params?.type === "string" && params.type ? params.type : "event",
    level,
    message: typeof params?.message === "string" ? params.message : "",
    detail: params?.detail
  };
}

/**
 * @param {{adapter?:any}} [opts]
 * @returns {Promise<any[]>}
 */
export async function listAuditEvents(opts = {}){
  const adapter = opts.adapter || storageAdapter;
  if(!adapter || typeof adapter.getAuditLog !== "function") return [];
  const list = await adapter.getAuditLog();
  return Array.isArray(list) ? list : [];
}

/**
 * Append a new audit event and prune to max size.
 * @param {{type?:string, message?:string, level?:string, detail?:any, now?:Date}} params
 * @param {{adapter?:any, max?:number}} [opts]
 * @returns {Promise<any[]>}
 */
export async function appendAuditEvent(params, opts = {}){
  const adapter = opts.adapter || storageAdapter;
  if(!adapter || typeof adapter.getAuditLog !== "function" || typeof adapter.saveAuditLog !== "function"){
    return [];
  }
  const event = createAuditEvent(params || {});
  const existing = await adapter.getAuditLog();
  const list = Array.isArray(existing) ? existing : [];
  const combined = list.concat(event).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const limit = Number.isFinite(opts.max) ? Math.max(1, opts.max) : MAX_AUDIT_EVENTS;
  const pruned = combined.slice(-limit);
  await adapter.saveAuditLog(pruned);
  return pruned;
}

export { MAX_AUDIT_EVENTS };

export {};
