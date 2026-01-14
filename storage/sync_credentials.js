// @ts-check

import { storageAdapter } from "./adapter.js";
import { DEFAULT_ENDPOINT } from "./remote_client.js";

const LINK_PREFIX = "shredmaxx://sync";

/**
 * @typedef {{
 *  spaceId?: string,
 *  authToken?: string,
 *  endpoint?: string,
 *  e2ee?: { enabled?: boolean, iterations?: number, hash?: string, salt?: string },
 *  recordMeta?: Record<string, any>,
 *  lastHlc?: string
 * }} SyncCredentials
 */

export async function getSyncCredentials(){
  return storageAdapter.getSyncCredentials?.();
}

/**
 * @param {SyncCredentials} creds
 */
export async function saveSyncCredentials(creds){
  await storageAdapter.saveSyncCredentials?.(creds || null);
}

export async function clearSyncCredentials(){
  await storageAdapter.saveSyncCredentials?.(null);
}

/**
 * Build a shareable sync link.
 * @param {SyncCredentials} creds
 */
export function buildSyncLink(creds){
  if(!creds?.spaceId || !creds?.authToken) return "";
  const url = new URL(LINK_PREFIX);
  url.searchParams.set("v", "1");
  url.searchParams.set("spaceId", creds.spaceId);
  url.searchParams.set("authToken", creds.authToken);
  const endpoint = creds.endpoint || DEFAULT_ENDPOINT;
  if(endpoint && endpoint !== DEFAULT_ENDPOINT){
    url.searchParams.set("endpoint", endpoint);
  }
  if(creds.e2ee?.enabled){
    url.searchParams.set("e2ee", "1");
    if(creds.e2ee.salt) url.searchParams.set("salt", creds.e2ee.salt);
    if(creds.e2ee.iterations) url.searchParams.set("iterations", String(creds.e2ee.iterations));
    if(creds.e2ee.hash) url.searchParams.set("hash", creds.e2ee.hash);
  }
  return url.toString();
}

/**
 * Parse a sync link string.
 * @param {string} link
 */
export function parseSyncLink(link){
  if(typeof link !== "string" || !link.trim()) return null;
  let url;
  try{
    url = new URL(link.trim());
  }catch(e){
    return null;
  }
  if(url.protocol !== "shredmaxx:" || !url.href.startsWith(LINK_PREFIX)){
    return null;
  }
  const spaceId = url.searchParams.get("spaceId") || "";
  const authToken = url.searchParams.get("authToken") || "";
  const endpoint = url.searchParams.get("endpoint") || DEFAULT_ENDPOINT;
  const e2ee = url.searchParams.get("e2ee") === "1";
  const salt = url.searchParams.get("salt") || "";
  const hash = url.searchParams.get("hash") || "";
  const iterationsRaw = url.searchParams.get("iterations");
  const iterations = iterationsRaw ? Number(iterationsRaw) : undefined;
  if(!spaceId || !authToken) return null;
  const out = { spaceId, authToken, endpoint };
  if(e2ee){
    out.e2ee = {
      enabled: true,
      salt: salt || undefined,
      hash: hash || undefined,
      iterations: Number.isFinite(iterations) ? iterations : undefined
    };
  }
  return out;
}

export {};
