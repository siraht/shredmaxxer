/* Shredmaxx — Solar Log (PWA, local-first)
   - Offline-first, no backend
   - Tracks protocol segments: FTN / Lunch / Dinner / Late
   - Tracks food diversity inside each segment (protein / carbs / fats / accoutrements)
   - Stores data IndexedDB-first with localStorage fallback + export/import
*/

import { getElements } from "./ui/elements.js";
import { createLegacyUI } from "./ui/legacy.js";
import { normalizeTri } from "./domain/heuristics.js";
import { ensureDayMeta, ensureSegmentMeta, touchDay, touchSegment } from "./domain/revisions.js";
import { activeDayKey, addDaysLocal, dateToKey, computeSunTimes } from "./domain/time.js";
import { createInsightsState, mergeInsightsState, dismissInsight } from "./domain/insights.js";
import { mergeRosters } from "./storage/merge.js";
import { savePreImportSnapshot, saveSnapshotWithRetention } from "./storage/snapshots.js";
import { createDefaultRosters, findDefaultRosterTemplate } from "./domain/roster_defaults.js";
import { createRosterItem, findRosterItemByLabel, normalizeLabel } from "./domain/roster.js";
import { setRosterLabel, setRosterAliases, setRosterTags, toggleRosterPinned, toggleRosterArchived } from "./domain/roster_edit.js";
import { migrateV3ToV4 } from "./storage/migrate.js";
import { APP_VERSION, buildMeta } from "./storage/meta.js";
import { serializeExport } from "./storage/export.js";
import { buildCsvExport } from "./storage/csv_export.js";
import { encryptExport, decryptExport } from "./storage/encrypted_export.js";
import { storageAdapter } from "./storage/adapter.js";
import { clearSegmentContents, createDefaultDay, mergeSettings, segmentHasContent, syncSegmentStatus } from "./app/helpers.js";
import {
  applySegmentStatus,
  copyDaySegmentsFromSource,
  copySegmentFromSource,
  scrubRosterItemFromDay,
  setSupplementsNotesInDay,
  toggleSegmentItemInSegment,
  toggleSupplementItemInDay
} from "./app/action_logic.js";
import { mergeLogs, validateImportPayload } from "./app/import_logic.js";

const STORAGE_KEY = "shredmaxx_tracker_v4";
const LEGACY_KEY_V3 = "shredmaxx_tracker_v3";
const LEGACY_KEY_V1 = "shredmaxx_tracker_v1";

// Legacy label rosters (used only for v1/v3 migration paths).
const LEGACY_ROSTERS = {
  proteins: [
    "Beef",
    "Bison",
    "Lamb",
    "Elk/Venison",
    "Shrimp",
    "Scallops",
    "Whitefish (cod/halibut)",
    "Fatty fish (sardines/oysters)",
    "Eggs",
    "Non-fat dairy",
    "Collagen/Gelatin"
  ],
  carbs: [
    "Fruit (whole)",
    "Fruit juice",
    "Honey",
    "White rice",
    "Rice noodles",
    "Potatoes",
    "Sweet potatoes",
    "Sprouted oats",
    "Sourdough"
  ],
  fats: [
    "Coconut oil",
    "MCT oil",
    "Tallow / stearic",
    "Butter / ghee",
    "Cocoa butter",
    "Egg yolks",
    "Raw cheese",
    "Olive oil (sparingly)",
    "Avocado"
  ],
  micros: [
    "Garlic",
    "Red onion",
    "Ginger",
    "Rosemary",
    "Thyme",
    "Basil / holy basil",
    "Cayenne",
    "Parsley",
    "Cilantro",
    "Arugula (bitter greens)",
    "Seaweed"
  ],
  supplements: []
};

const DEFAULT_SETTINGS = {
  // Timeline boundaries
  dayStart: "06:00",
  dayEnd: "23:59",

  // Protocol segments
  ftnEnd: "12:00",
  lunchEnd: "16:00",
  dinnerEnd: "21:00",

  // Solar visualization
  sunrise: "07:00",
  sunset: "17:00",

  focusMode: "nowfade", // "full" | "nowfade"
  sunMode: "manual", // "manual" | "auto"
  phase: "", // "" | "strict" | "maintenance" | "advanced"
  weekStart: 0, // 0=Sunday
  nudgesEnabled: false,
  supplementsMode: "none", // "" | "none" | "essential" | "advanced"
  lastKnownLat: undefined,
  lastKnownLon: undefined,
  privacy: {
    appLock: false,
    redactHome: false,
    exportEncryptedByDefault: false,
    blurOnBackground: false
  }
};

const SEGMENTS = [
  { id: "ftn", label: "FTN", sub: "Carb window" },
  { id: "lunch", label: "Lunch", sub: "Carb + protein" },
  { id: "dinner", label: "Dinner", sub: "Protein + fat" },
  { id: "late", label: "Late", sub: "Bed / damage control" }
];

function deepClone(x){
  return (typeof structuredClone === "function")
    ? structuredClone(x)
    : JSON.parse(JSON.stringify(x));
}

function yyyyMmDd(d){
  return dateToKey(d);
}

function dateFromKey(dateKey){
  return new Date(`${dateKey}T12:00:00`);
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function parseTimeToMinutes(hhmm){
  if(!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h * 60 + m);
}

function minutesToTime(m){
  m = ((m % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function fmtTime(hhmm){
  // display 24h because that's what <input type=time> uses
  return hhmm || "—";
}

function safeLocalStorageSet(key, value){
  try{
    if(typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  }catch(e){
    // ignore localStorage failures (blocked/quota/etc.)
  }
}

function safeLocalStorageGet(key){
  try{
    if(typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  }catch(e){
    return null;
  }
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nowMinutes(){
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function createDefaultState(){
  const now = new Date();
  return {
    version: 4,
    meta: buildMeta(null, {
      storageMode: "localStorage",
      persistStatus: "unknown",
      appVersion: APP_VERSION
    }),
    settings: deepClone(DEFAULT_SETTINGS),
    rosters: createDefaultRosters(now),
    insights: createInsightsState(),
    logs: {}
  };
}

function migrateFromLegacy(old){
  // old shape: { settings?, rosters?, logs: {dateKey: {ftn, movedBeforeLunch, ... , proteins, carbs, fats, micros}}}
  const s = {
    version: 3,
    settings: deepClone(DEFAULT_SETTINGS),
    rosters: deepClone(LEGACY_ROSTERS),
    logs: {}
  };

  if(old && typeof old === "object"){
    if(old.settings) s.settings = mergeSettings(s.settings, old.settings);
    if(old.rosters) s.rosters = {
      proteins: Array.isArray(old.rosters.proteins) ? old.rosters.proteins : s.rosters.proteins,
      carbs: Array.isArray(old.rosters.carbs) ? old.rosters.carbs : s.rosters.carbs,
      fats: Array.isArray(old.rosters.fats) ? old.rosters.fats : s.rosters.fats,
      micros: Array.isArray(old.rosters.micros) ? old.rosters.micros : s.rosters.micros,
      supplements: Array.isArray(old.rosters.supplements) ? old.rosters.supplements : s.rosters.supplements
    };

    if(old.logs && typeof old.logs === "object"){
      for(const [dateKey, lg] of Object.entries(old.logs)){
        const d = createDefaultDay();
        // carry daily toggles
        d.movedBeforeLunch = !!lg.movedBeforeLunch;
        d.trained = !!lg.trained;
        d.highFatDay = !!lg.highFatDay;
        d.energy = lg.energy || "";
        d.mood = lg.mood || "";
        d.cravings = lg.cravings || "";
        d.notes = lg.notes || "";

        // map old FTN
        if(lg.ftn) d.segments.ftn.ftnMode = lg.ftn; // ftn|lite|off

        // map old seed oils + collision heuristically to lunch
        if(lg.seedOilExposure) d.segments.lunch.seedOil = lg.seedOilExposure; // none|yes
        if(lg.fuelSegmentation === "collision") d.segments.lunch.collision = "yes";

        // old diversity gets shoved into Lunch (historical; user can ignore)
        if(Array.isArray(lg.proteins)) d.segments.lunch.proteins = [...lg.proteins];
        if(Array.isArray(lg.carbs)) d.segments.lunch.carbs = [...lg.carbs];
        if(Array.isArray(lg.fats)) d.segments.lunch.fats = [...lg.fats];
        if(Array.isArray(lg.micros)) d.segments.lunch.micros = [...lg.micros];

        s.logs[dateKey] = d;
      }
    }
  }
  return migrateV3ToV4(s, {
    appVersion: APP_VERSION,
    storageMode: "localStorage",
    persistStatus: "unknown"
  });
}

async function loadState(){
  // Try v4 storage adapter first (IndexedDB or localStorage fallback)
  try {
    const v4State = await storageAdapter.loadState();
    if(v4State && (v4State.version === 4 || v4State.meta?.version === 4)) {
      return hydrateState(v4State);
    }
  } catch(e) {
    console.warn("Storage adapter load failed, will try legacy localStorage", e);
  }

  // Fallback: check legacy localStorage keys for migration
  // Prefer v4 key in localStorage
  const raw = safeLocalStorageGet(STORAGE_KEY);
  if(raw){
    try{
      const obj = JSON.parse(raw);
      if(obj && obj.version === 4) return hydrateState(obj);
      if(obj && obj.version === 3){
        return migrateV3ToV4(obj, {
          appVersion: APP_VERSION,
          storageMode: "localStorage",
          persistStatus: "unknown"
        });
      }
      return migrateFromLegacy(obj);
    }catch(e){
      console.warn("State parse failed", e);
    }
  }

  // Fallback: migrate from v3 key
  const legacyRaw = safeLocalStorageGet(LEGACY_KEY_V3);
  if(legacyRaw){
    try{
      const legacy = JSON.parse(legacyRaw);
      const migrated = legacy && legacy.version === 3
        ? migrateV3ToV4(legacy, {
          appVersion: APP_VERSION,
          storageMode: "localStorage",
          persistStatus: "unknown"
        })
        : migrateFromLegacy(legacy);
      // don't delete legacy automatically; user may still be using older build
      return migrated;
    }catch(e){
      console.warn("Legacy parse failed", e);
    }
  }

  // Fallback: migrate from v1 key
  const legacyV1Raw = safeLocalStorageGet(LEGACY_KEY_V1);
  if(legacyV1Raw){
    try{
      const legacy = JSON.parse(legacyV1Raw);
      const migrated = migrateFromLegacy(legacy);
      return migrated;
    }catch(e){
      console.warn("Legacy parse failed", e);
    }
  }

  return createDefaultState();
}

function hydrateState(obj){
  const s = createDefaultState();
  if(obj.meta) s.meta = { ...s.meta, ...obj.meta };
  if(obj.settings) s.settings = mergeSettings(s.settings, obj.settings);
  if(obj.insights) s.insights = mergeInsightsState(s.insights, obj.insights);
  if(obj.rosters){
    for(const k of ["proteins", "carbs", "fats", "micros", "supplements"]){
      if(Array.isArray(obj.rosters[k])) s.rosters[k] = obj.rosters[k];
    }
  }
  if(obj.logs && typeof obj.logs === "object") s.logs = obj.logs;
  s.version = 4;
  return s;
}

let state = createDefaultState();

async function initializeState() {
  state = await loadState();
  return state;
}

function getActiveDateKey(){
  return activeDayKey(new Date(), state.settings);
}

function getActiveDate(){
  return dateFromKey(getActiveDateKey());
}

let currentDate = getActiveDate();
let currentSegmentId = null;

async function persistDay(dateKey, dayLog) {
  try {
    await storageAdapter.saveDay(dateKey, dayLog);
  } catch(e) {
    console.error("Failed to persist day:", e);
    // Fallback to localStorage for safety
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(state));
  }
}

async function persistRosters() {
  try {
    await storageAdapter.saveRosters(state.rosters);
  } catch(e) {
    console.error("Failed to persist rosters:", e);
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(state));
  }
}

async function persistSettings() {
  try {
    await storageAdapter.saveSettings(state.settings);
  } catch(e) {
    console.error("Failed to persist settings:", e);
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(state));
  }
}

async function persistInsights() {
  try {
    if(storageAdapter.saveInsights){
      await storageAdapter.saveInsights(state.insights);
    }else{
      safeLocalStorageSet(STORAGE_KEY, JSON.stringify(state));
    }
  } catch(e) {
    console.error("Failed to persist insights:", e);
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(state));
  }
}

async function persistAll() {
  try {
    await storageAdapter.saveMeta(state.meta);
    await storageAdapter.saveSettings(state.settings);
    if(storageAdapter.saveInsights){
      await storageAdapter.saveInsights(state.insights);
    }
    await storageAdapter.saveRosters(state.rosters);
    for (const [dateKey, dayLog] of Object.entries(state.logs)) {
      await storageAdapter.saveDay(dateKey, dayLog);
    }
  } catch(e) {
    console.error("Failed to persist all state:", e);
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(state));
  }
}

async function listSnapshots(){
  try{
    return await storageAdapter.listSnapshots();
  }catch(e){
    console.error("Failed to list snapshots:", e);
    return [];
  }
}

async function createSnapshot(label){
  const nextLabel = (typeof label === "string" && label.trim()) ? label.trim() : "Manual snapshot";
  try{
    const result = await saveSnapshotWithRetention({ label: nextLabel, state });
    return result?.saved || null;
  }catch(e){
    console.error("Failed to create snapshot:", e);
    throw e;
  }
}

async function restoreSnapshot(snapshotId){
  await storageAdapter.restoreSnapshot(snapshotId);
  const loaded = await storageAdapter.loadState();
  if(loaded){
    state = hydrateState(loaded);
  }else{
    state = createDefaultState();
  }
}

async function deleteSnapshot(snapshotId){
  try{
    await storageAdapter.deleteSnapshot(snapshotId);
  }catch(e){
    console.error("Failed to delete snapshot:", e);
    throw e;
  }
}

function getDay(dateKey){
  const existing = state.logs[dateKey];
  const base = createDefaultDay();
  if(!existing) return base;

  const out = { ...base, ...existing };

  // deep-merge segments so new fields don't break old logs
  const exSegs = (existing.segments && typeof existing.segments === "object") ? existing.segments : {};
  out.segments = { ...base.segments, ...exSegs };

  for(const segId of Object.keys(base.segments)){
    const b = base.segments[segId];
    const e = exSegs[segId] || {};
    out.segments[segId] = { ...b, ...e };

    // ensure arrays
    for(const k of ["proteins", "carbs", "fats", "micros"]){
      if(!Array.isArray(out.segments[segId][k])) out.segments[segId][k] = [];
    }
    if(typeof out.segments[segId].status !== "string" || !out.segments[segId].status){
      out.segments[segId].status = "unlogged";
    }
    if(typeof out.segments[segId].collision === "boolean"){
      out.segments[segId].collision = out.segments[segId].collision ? "yes" : "no";
    }else{
      out.segments[segId].collision = normalizeTri(out.segments[segId].collision);
    }
    if(typeof out.segments[segId].highFatMeal === "boolean"){
      out.segments[segId].highFatMeal = out.segments[segId].highFatMeal ? "yes" : "no";
    }else{
      out.segments[segId].highFatMeal = normalizeTri(out.segments[segId].highFatMeal);
    }
    if(typeof out.segments[segId].seedOil !== "string") out.segments[segId].seedOil = out.segments[segId].seedOil ? String(out.segments[segId].seedOil) : "";
    if(typeof out.segments[segId].notes !== "string") out.segments[segId].notes = out.segments[segId].notes ? String(out.segments[segId].notes) : "";
    if(typeof out.segments[segId].tsFirst !== "string") out.segments[segId].tsFirst = out.segments[segId].tsFirst ? String(out.segments[segId].tsFirst) : "";
    if(typeof out.segments[segId].tsLast !== "string") out.segments[segId].tsLast = out.segments[segId].tsLast ? String(out.segments[segId].tsLast) : "";
    if(segId === "ftn" && typeof out.segments[segId].ftnMode !== "string") out.segments[segId].ftnMode = out.segments[segId].ftnMode ? String(out.segments[segId].ftnMode) : "";
    ensureSegmentMeta(out.segments[segId]);
    syncSegmentStatus(out.segments[segId], segId);
  }

  const defaultSuppMode = state?.settings?.supplementsMode || "none";
  const supp = (out.supplements && typeof out.supplements === "object")
    ? { ...out.supplements }
    : { mode: defaultSuppMode, items: [], notes: "", tsLast: "" };
  if(typeof supp.mode !== "string" || !supp.mode){
    supp.mode = defaultSuppMode;
  }
  if(!Array.isArray(supp.items)) supp.items = [];
  if(typeof supp.notes !== "string") supp.notes = supp.notes ? String(supp.notes) : "";
  if(typeof supp.tsLast !== "string") supp.tsLast = supp.tsLast ? String(supp.tsLast) : "";
  out.supplements = supp;

  ensureDayMeta(out);
  return out;
}

function setDay(dateKey, day){
  state.logs[dateKey] = deepClone(day);
  // Fire-and-forget persistence (don't block UI)
  persistDay(dateKey, day).catch(e => console.error("Persist day failed:", e));
}

function addDays(d, days){
  return addDaysLocal(d, days);
}

function dayHasSegmentData(day){
  const segments = day?.segments || {};
  for(const [segId, seg] of Object.entries(segments)){
    if(segmentHasContent(seg, segId)) return true;
    if(seg?.status === "none") return true;
  }
  return false;
}

function canCopyYesterday(dateKey){
  const sourceKey = dateToKey(addDaysLocal(dateFromKey(dateKey), -1));
  const source = state.logs[sourceKey];
  return !!(source && dayHasSegmentData(source));
}

function copyYesterday(dateKey){
  const sourceKey = dateToKey(addDaysLocal(dateFromKey(dateKey), -1));
  const source = state.logs[sourceKey];
  if(!source || !dayHasSegmentData(source)) return false;

  const day = getDay(dateKey);
  const nowIso = new Date().toISOString();
  copyDaySegmentsFromSource(day, source, nowIso);
  touchDay(day, nowIso);
  setDay(dateKey, day);
  return true;
}

// mergeSettings/createDefaultDay/segment helpers live in app/helpers.js

function toggleSegmentItem(dateKey, segId, category, itemId){
  const day = getDay(dateKey);
  const seg = day.segments[segId];
  if(!seg) return;
  const nowIso = new Date().toISOString();
  toggleSegmentItemInSegment(seg, segId, category, itemId, nowIso);
  touchDay(day, nowIso);
  setDay(dateKey, day);
}

function setSegmentStatus(dateKey, segId, status){
  const day = getDay(dateKey);
  const seg = day.segments[segId];
  if(!seg) return;
  const nowIso = new Date().toISOString();
  if(!applySegmentStatus(seg, segId, status, nowIso)) return;
  touchDay(day, nowIso);
  setDay(dateKey, day);
}

function setSegmentField(dateKey, segId, field, value){
  if(field === "status"){
    setSegmentStatus(dateKey, segId, value);
    return;
  }
  const day = getDay(dateKey);
  const seg = day.segments[segId];
  if(!seg) return;
  if(seg[field] === value) return;

  seg[field] = value;
  syncSegmentStatus(seg, segId);

  const nowIso = new Date().toISOString();
  touchSegment(seg, nowIso);
  touchDay(day, nowIso);

  setDay(dateKey, day);
}

function clearSegment(dateKey, segId){
  const day = getDay(dateKey);
  const seg = day.segments[segId];
  if(!seg) return;
  if(!segmentHasContent(seg, segId) && seg.status === "unlogged") return;

  clearSegmentContents(seg, segId);
  seg.status = "unlogged";
  const nowIso = new Date().toISOString();
  touchSegment(seg, nowIso);
  touchDay(day, nowIso);

  setDay(dateKey, day);
}

function copySegment(dateKey, targetSegId, sourceSeg){
  if(!sourceSeg || !targetSegId) return;
  const day = getDay(dateKey);
  const target = day.segments[targetSegId];
  if(!target) return;
  const nowIso = new Date().toISOString();
  const next = copySegmentFromSource(targetSegId, target, sourceSeg, nowIso);
  day.segments[targetSegId] = next;
  touchDay(day, nowIso);
  setDay(dateKey, day);
}

function setDayField(dateKey, field, value){
  const day = getDay(dateKey);
  if(day[field] === value) return;
  day[field] = value;
  touchDay(day);
  setDay(dateKey, day);
}

function toggleSupplementItem(dateKey, itemId){
  const day = getDay(dateKey);
  const defaultMode = state?.settings?.supplementsMode || "none";
  const nowIso = new Date().toISOString();
  if(!toggleSupplementItemInDay(day, itemId, defaultMode, nowIso)) return;
  touchDay(day, nowIso);
  setDay(dateKey, day);
}

function setSupplementsNotes(dateKey, notes){
  const day = getDay(dateKey);
  const defaultMode = state?.settings?.supplementsMode || "none";
  const nowIso = new Date().toISOString();
  if(!setSupplementsNotesInDay(day, notes, defaultMode, nowIso)) return;
  touchDay(day, nowIso);
  setDay(dateKey, day);
}

function toggleBoolField(dateKey, field){
  const day = getDay(dateKey);
  day[field] = !day[field];
  touchDay(day);
  setDay(dateKey, day);
}

function addRosterItem(category, item){
  const name = normalizeLabel(item || "");
  if(!name) return;

  const roster = state.rosters[category] || [];
  if(findRosterItemByLabel(roster, name)) return;

  const template = findDefaultRosterTemplate(category, name);
  const entry = createRosterItem(name, { tags: template?.tags || [] });
  roster.push(entry);
  state.rosters[category] = roster;
  persistRosters().catch(e => console.error("Persist rosters failed:", e));
  return entry;
}

function removeRosterItem(category, itemId){
  const roster = state.rosters[category] || [];
  const idx = roster.findIndex((entry) => entry && entry.id === itemId);
  if(idx < 0) return;

  roster.splice(idx, 1);
  state.rosters[category] = roster;

  // scrub from logs
  const nowIso = new Date().toISOString();
  for(const dk of Object.keys(state.logs)){
    const day = getDay(dk);
    const dayChanged = scrubRosterItemFromDay(day, category, itemId, nowIso);
    if(dayChanged){
      touchDay(day, nowIso);
      state.logs[dk] = day;
      persistDay(dk, day).catch(e => console.error("Persist day failed:", e));
    }
  }

  persistRosters().catch(e => console.error("Persist rosters failed:", e));
}

function updateRosterItem(category, itemId, updater){
  const roster = state.rosters[category] || [];
  const idx = roster.findIndex((entry) => entry && entry.id === itemId);
  if(idx < 0) return null;
  const current = roster[idx];
  const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  if(!next) return null;
  roster[idx] = next;
  state.rosters[category] = roster;
  persistRosters().catch(e => console.error("Persist rosters failed:", e));
  return next;
}

function updateRosterLabel(category, itemId, label){
  const normalized = normalizeLabel(label || "");
  if(!normalized) return null;
  return updateRosterItem(category, itemId, (item) => setRosterLabel(item, normalized));
}

function updateRosterAliases(category, itemId, aliases){
  return updateRosterItem(category, itemId, (item) => setRosterAliases(item, aliases));
}

function updateRosterTags(category, itemId, tags){
  return updateRosterItem(category, itemId, (item) => setRosterTags(item, tags));
}

function toggleRosterPinnedAction(category, itemId){
  return updateRosterItem(category, itemId, (item) => toggleRosterPinned(item));
}

function toggleRosterArchivedAction(category, itemId){
  return updateRosterItem(category, itemId, (item) => toggleRosterArchived(item));
}

async function exportState(mode){
  if(mode && typeof mode === "object" && mode.type){
    mode = undefined;
  }
  const now = new Date();
  const dateLabel = yyyyMmDd(now);
  const useEncrypted = (mode === "encrypted")
    ? true
    : (mode === "plain")
      ? false
      : !!state.settings?.privacy?.exportEncryptedByDefault;

  if(useEncrypted){
    const passphrase = prompt("Enter passphrase for encrypted export:");
    if(!passphrase){
      alert("Encrypted export canceled (no passphrase).");
      return;
    }
    const confirmPass = prompt("Confirm passphrase:");
    if(confirmPass !== passphrase){
      alert("Passphrases did not match. Export canceled.");
      return;
    }
    try{
      const payload = await encryptExport(state, passphrase, { exportOptions: { appVersion: APP_VERSION, now } });
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `shredmaxx_solar_log_${dateLabel}.encrypted.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }catch(e){
      console.error("Encrypted export failed:", e);
      alert("Encrypted export failed. Check WebCrypto support.");
      return;
    }
  }

  const json = serializeExport(state, { appVersion: APP_VERSION, now });
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `shredmaxx_solar_log_${dateLabel}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCsv(){
  const now = new Date();
  const dateLabel = yyyyMmDd(now);
  const csv = buildCsvExport(state);
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `shredmaxx_solar_log_${dateLabel}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function decryptImportPayload(payload, passphrase){
  if(!passphrase){
    return { ok: false, error: "Passphrase required to decrypt import." };
  }
  try{
    const decoded = await decryptExport(payload, passphrase);
    return { ok: true, payload: decoded };
  }catch(e){
    return { ok: false, error: "Decrypt failed. Check passphrase and try again." };
  }
}

async function importState(file){
  const text = await file.text();
  const obj = JSON.parse(text);
  const result = await applyImportPayload(obj, "replace");
  if(!result.ok){
    throw new Error(result.error || "Import failed.");
  }
}

function updateSettings(nextSettings){
  state.settings = mergeSettings(state.settings, nextSettings);
  persistSettings().catch(e => console.error("Persist settings failed:", e));
}

function dismissInsightAction(insight){
  if(!insight) return;
  state.insights = dismissInsight(state.insights, insight);
  persistInsights().catch(e => console.error("Persist insights failed:", e));
}

function toggleFocusMode(){
  state.settings.focusMode = (state.settings.focusMode === "full") ? "nowfade" : "full";
  persistSettings().catch(e => console.error("Persist settings failed:", e));
}

function resetDay(dateKey){
  state.logs[dateKey] = createDefaultDay();
  persistDay(dateKey, state.logs[dateKey]).catch(e => console.error("Persist day failed:", e));
}

function replaceState(nextState){
  if(!nextState || typeof nextState !== "object") return;
  state = deepClone(nextState);
  persistAll().catch(e => console.error("Persist state failed:", e));
}

async function applyImportPayload(payload, mode){
  const validation = validateImportPayload(payload);
  if(!validation.ok){
    return validation;
  }

  await savePreImportSnapshot({ state }).catch(() => {});

  let next = null;
  if(validation.version === 4){
    next = {
      version: 4,
      meta: payload.meta,
      settings: payload.settings,
      rosters: payload.rosters,
      insights: payload.insights || createInsightsState(),
      logs: payload.logs
    };
  }else if(payload && payload.version === 3){
    next = migrateV3ToV4(payload, {
      appVersion: APP_VERSION,
      storageMode: "localStorage",
      persistStatus: "unknown"
    });
  }else{
    next = migrateFromLegacy(payload);
  }
  if(next){
    next.settings = mergeSettings(DEFAULT_SETTINGS, next.settings || {});
  }
  if(mode === "replace"){
    next.insights = mergeInsightsState(createInsightsState(), next.insights);
    state = next;
    await persistAll();
    return { ok: true, mode: "replace", version: validation.version, legacy: validation.legacy };
  }

  const merged = {
    ...state,
    rosters: mergeRosters(state.rosters, next.rosters, { dedupeByLabel: true }),
    logs: mergeLogs(state.logs, next.logs),
    insights: mergeInsightsState(state.insights, next.insights)
  };

  state = merged;
  await persistAll();
  return { ok: true, mode: "merge", version: validation.version, legacy: validation.legacy };
}

const els = getElements();
const ui = createLegacyUI({
  els,
  getState: () => state,
  getDay,
  setDay,
  getCurrentDate: () => currentDate,
  setCurrentDate: (d) => { currentDate = d; },
  getCurrentSegmentId: () => currentSegmentId,
  setCurrentSegmentId: (id) => { currentSegmentId = id; },
  helpers: {
    parseTimeToMinutes,
    minutesToTime,
    fmtTime,
    escapeHtml,
    clamp,
    nowMinutes,
    computeSunTimes,
    yyyyMmDd,
    addDays,
    dateFromKey,
    getActiveDateKey
  },
  defaults: {
    DEFAULT_SETTINGS
  },
  actions: {
    toggleSegmentItem,
    setSegmentField,
    setSegmentStatus,
    clearSegment,
    copySegment,
    canCopyYesterday,
    copyYesterday,
    setDayField,
    toggleSupplementItem,
    setSupplementsNotes,
    toggleBoolField,
    addRosterItem,
    removeRosterItem,
    updateRosterLabel,
    updateRosterAliases,
    updateRosterTags,
    toggleRosterPinned: toggleRosterPinnedAction,
    toggleRosterArchived: toggleRosterArchivedAction,
    exportState,
    exportCsv,
    importState,
    decryptImportPayload,
    validateImportPayload,
    applyImportPayload,
    listSnapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    replaceState,
    updateSettings,
    toggleFocusMode,
    dismissInsight: dismissInsightAction,
    resetDay
  }
});

// Boot sequence: load state, then initialize UI
(async function boot() {
  try {
    await initializeState();
    ui.init();
  } catch(e) {
    console.error("Boot failed:", e);
    // Fall back to default state and init UI anyway
    ui.init();
  }
})();
