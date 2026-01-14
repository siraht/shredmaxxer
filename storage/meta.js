// @ts-check

import { generateId } from "../domain/roster.js";

export const APP_VERSION = "0.0.0-dev";

/**
 * Build a normalized Meta object.
 * @param {any} existing
 * @param {{
 *  storageMode: "idb"|"localStorage",
 *  persistStatus: ""|"unknown"|"granted"|"denied",
 *  appVersion?: string
 * }} params
 */
export function buildMeta(existing, params){
  const base = existing && typeof existing === "object" ? existing : {};
  const installId = typeof base.installId === "string" && base.installId ? base.installId : generateId();
  return {
    version: 4,
    installId,
    appVersion: params.appVersion || base.appVersion || "",
    storageMode: params.storageMode,
    persistStatus: params.persistStatus,
    lastSnapshotTs: base.lastSnapshotTs
  };
}

/**
 * Shallow compare key meta fields.
 * @param {any} a
 * @param {any} b
 */
export function isMetaEqual(a, b){
  if(!a || !b) return false;
  return (
    a.version === b.version &&
    a.installId === b.installId &&
    a.appVersion === b.appVersion &&
    a.storageMode === b.storageMode &&
    a.persistStatus === b.persistStatus &&
    a.lastSnapshotTs === b.lastSnapshotTs
  );
}

export {};
