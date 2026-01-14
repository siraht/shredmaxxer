// @ts-check

/**
 * Normalize a roster label for storage and comparison.
 * - trims
 * - collapses internal whitespace
 * @param {string} label
 * @returns {string}
 */
export function normalizeLabel(label){
  if(!label) return "";
  return String(label).trim().replace(/\s+/g, " ");
}

/**
 * Create a case-insensitive key for label comparisons.
 * @param {string} label
 * @returns {string}
 */
export function labelKey(label){
  return normalizeLabel(label).toLowerCase();
}

/**
 * Generate a UUID v4 string. Uses crypto when available.
 * @returns {string}
 */
export function generateId(){
  if(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"){
    return crypto.randomUUID();
  }

  if(typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"){
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // RFC 4122 version 4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
  }

  // Fallback: non-crypto UUID (best-effort uniqueness)
  let d = Date.now();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Find a roster item by label (case-insensitive).
 * @param {{label:string}[]} items
 * @param {string} label
 * @returns {{label:string}|null}
 */
export function findRosterItemByLabel(items, label){
  const key = labelKey(label);
  if(!key) return null;
  const list = Array.isArray(items) ? items : [];
  return list.find((item) => labelKey(item.label) === key) || null;
}

/**
 * Check if a label is unique in the roster (case-insensitive).
 * @param {{label:string}[]} items
 * @param {string} label
 * @returns {boolean}
 */
export function isUniqueLabel(items, label){
  return !findRosterItemByLabel(items, label);
}

/**
 * Dedupe roster items by normalized label (case-insensitive).
 * Returns a new array and the duplicates encountered.
 *
 * If labels are empty/invalid, items are keyed by id or position to avoid
 * accidental merges.
 *
 * @param {{id?:string,label?:string}[]} items
 * @param {(kept: any, incoming: any) => any} [onDuplicate]
 * @returns {{items: any[], duplicates: {kept:any, removed:any}[]}}
 */
export function dedupeRosterByLabel(items, onDuplicate){
  const list = Array.isArray(items) ? items : [];
  const seen = new Map();
  const out = [];
  const duplicates = [];

  list.forEach((item, index) => {
    if(!item || typeof item !== "object") return;
    const rawLabel = typeof item.label === "string" ? item.label : "";
    const key = labelKey(rawLabel);
    const stableKey = key || (item.id ? `id:${item.id}` : `idx:${index}`);

    if(seen.has(stableKey)){
      const keptIndex = seen.get(stableKey);
      const kept = out[keptIndex];
      const merged = typeof onDuplicate === "function" ? onDuplicate(kept, item) : kept;
      if(merged && merged !== kept) out[keptIndex] = merged;
      duplicates.push({ kept: out[keptIndex], removed: item });
      return;
    }

    seen.set(stableKey, out.length);
    out.push(item);
  });

  return { items: out, duplicates };
}

/**
 * Create a new roster item with stable ID and timestamps.
 * @param {string} label
 * @param {{
 *   id?: string,
 *   aliases?: string[],
 *   tags?: string[],
 *   pinned?: boolean,
 *   archived?: boolean,
 *   now?: Date
 * }} [options]
 * @returns {{
 *   id: string,
 *   label: string,
 *   aliases: string[],
 *   tags: string[],
 *   pinned: boolean,
 *   archived: boolean,
 *   tsCreated: string,
 *   tsUpdated: string
 * }}
 */
export function createRosterItem(label, options){
  const opts = options || {};
  const normalized = normalizeLabel(label);
  const now = opts.now instanceof Date ? opts.now : new Date();
  const iso = now.toISOString();
  return {
    id: opts.id || generateId(),
    label: normalized,
    aliases: Array.isArray(opts.aliases) ? [...opts.aliases] : [],
    tags: Array.isArray(opts.tags) ? [...opts.tags] : [],
    pinned: !!opts.pinned,
    archived: !!opts.archived,
    tsCreated: iso,
    tsUpdated: iso
  };
}

/**
 * Return a new roster item with an updated label and timestamp.
 * @param {{label:string, tsUpdated:string}} item
 * @param {string} nextLabel
 * @param {Date} [now]
 * @returns {{label:string, tsUpdated:string}}
 */
export function updateRosterLabel(item, nextLabel, now){
  const normalized = normalizeLabel(nextLabel);
  const ts = (now instanceof Date ? now : new Date()).toISOString();
  return {
    ...item,
    label: normalized,
    tsUpdated: ts
  };
}

export {};
