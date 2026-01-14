// @ts-check

import { normalizeLabel } from "./roster.js";

function normalizeList(list){
  const out = [];
  const seen = new Set();
  const items = Array.isArray(list) ? list : [];
  for(const raw of items){
    const value = String(raw || "").trim();
    if(!value) continue;
    const key = value.toLowerCase();
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * Update a roster item label and timestamp.
 * @param {any} item
 * @param {string} label
 * @param {Date} [now]
 * @returns {any}
 */
export function setRosterLabel(item, label, now){
  const ts = (now instanceof Date ? now : new Date()).toISOString();
  return {
    ...item,
    label: normalizeLabel(label),
    tsUpdated: ts
  };
}

/**
 * Update roster aliases (trimmed, de-duped).
 * @param {any} item
 * @param {string[]} aliases
 * @param {Date} [now]
 * @returns {any}
 */
export function setRosterAliases(item, aliases, now){
  const ts = (now instanceof Date ? now : new Date()).toISOString();
  return {
    ...item,
    aliases: normalizeList(aliases),
    tsUpdated: ts
  };
}

/**
 * Update roster tags (trimmed, de-duped).
 * @param {any} item
 * @param {string[]} tags
 * @param {Date} [now]
 * @returns {any}
 */
export function setRosterTags(item, tags, now){
  const ts = (now instanceof Date ? now : new Date()).toISOString();
  return {
    ...item,
    tags: normalizeList(tags),
    tsUpdated: ts
  };
}

/**
 * Toggle pinned flag.
 * @param {any} item
 * @param {Date} [now]
 * @returns {any}
 */
export function toggleRosterPinned(item, now){
  const ts = (now instanceof Date ? now : new Date()).toISOString();
  return {
    ...item,
    pinned: !item?.pinned,
    tsUpdated: ts
  };
}

/**
 * Toggle archived flag.
 * @param {any} item
 * @param {Date} [now]
 * @returns {any}
 */
export function toggleRosterArchived(item, now){
  const ts = (now instanceof Date ? now : new Date()).toISOString();
  return {
    ...item,
    archived: !item?.archived,
    tsUpdated: ts
  };
}

export default {
  setRosterLabel,
  setRosterAliases,
  setRosterTags,
  toggleRosterPinned,
  toggleRosterArchived
};
