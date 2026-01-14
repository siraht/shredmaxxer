/* Shredmaxx — Solar Log (PWA, local-first)
   - Offline-first, no backend
   - Tracks protocol segments: FTN / Lunch / Dinner / Late
   - Tracks food diversity inside each segment (protein / carbs / fats / accoutrements)
   - Stores data in localStorage, with export/import for backup
*/

import { getElements } from "./ui/elements.js";
import { createLegacyUI } from "./ui/legacy.js";
import { normalizeTri } from "./domain/heuristics.js";
import { ensureDayMeta, ensureSegmentMeta, touchDay, touchSegment } from "./domain/revisions.js";
import { activeDayKey, addDaysLocal, dateToKey } from "./domain/time.js";
import { mergeDay, mergeRosters } from "./storage/merge.js";
import { savePreImportSnapshot } from "./storage/snapshots.js";
import { createDefaultRosters, findDefaultRosterTemplate } from "./domain/roster_defaults.js";
import { createRosterItem, findRosterItemByLabel, normalizeLabel } from "./domain/roster.js";
import { setRosterLabel, setRosterAliases, setRosterTags, toggleRosterPinned, toggleRosterArchived } from "./domain/roster_edit.js";
import { migrateV3ToV4 } from "./storage/migrate.js";
import { APP_VERSION, buildMeta } from "./storage/meta.js";
import { validateImportPayload as validateV4Import } from "./storage/validate.js";
import { serializeExport } from "./storage/export.js";
import { storageAdapter } from "./storage/adapter.js";

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
  ]
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
  lastKnownLat: undefined,
  lastKnownLon: undefined,
  privacy: {
    appLock: false,
    redactHome: false,
    exportEncryptedByDefault: false
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

function createDefaultDay(){
  return {
    segments: {
      ftn: { status: "unlogged", ftnMode: "", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 },
      lunch: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 },
      dinner: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 },
      late: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 }
    },
    movedBeforeLunch: false,
    trained: false,
    highFatDay: false,
    energy: "",
    mood: "",
    cravings: "",
    notes: "",
    tsCreated: "",
    tsLast: "",
    rev: 0
  };
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
    if(old.settings) s.settings = { ...s.settings, ...old.settings };
    if(old.rosters) s.rosters = {
      proteins: Array.isArray(old.rosters.proteins) ? old.rosters.proteins : s.rosters.proteins,
      carbs: Array.isArray(old.rosters.carbs) ? old.rosters.carbs : s.rosters.carbs,
      fats: Array.isArray(old.rosters.fats) ? old.rosters.fats : s.rosters.fats,
      micros: Array.isArray(old.rosters.micros) ? old.rosters.micros : s.rosters.micros
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
    if(v4State && v4State.version === 4) {
      return hydrateState(v4State);
    }
  } catch(e) {
    console.warn("Storage adapter load failed, will try legacy localStorage", e);
  }

  // Fallback: check legacy localStorage keys for migration
  // Prefer v4 key in localStorage
  const raw = localStorage.getItem(STORAGE_KEY);
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
  const legacyRaw = localStorage.getItem(LEGACY_KEY_V3);
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
  const legacyV1Raw = localStorage.getItem(LEGACY_KEY_V1);
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
  if(obj.settings) s.settings = { ...s.settings, ...obj.settings };
  if(obj.rosters){
    for(const k of ["proteins", "carbs", "fats", "micros"]){
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

async function persistRosters() {
  try {
    await storageAdapter.saveRosters(state.rosters);
  } catch(e) {
    console.error("Failed to persist rosters:", e);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

async function persistSettings() {
  try {
    await storageAdapter.saveSettings(state.settings);
  } catch(e) {
    console.error("Failed to persist settings:", e);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

async function persistAll() {
  try {
    await storageAdapter.saveMeta(state.meta);
    await storageAdapter.saveSettings(state.settings);
    await storageAdapter.saveRosters(state.rosters);
    for (const [dateKey, dayLog] of Object.entries(state.logs)) {
      await storageAdapter.saveDay(dateKey, dayLog);
    }
  } catch(e) {
    console.error("Failed to persist all state:", e);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function segmentHasContent(seg, segId){
  if(!seg) return false;
  const hasItems = seg.proteins.length || seg.carbs.length || seg.fats.length || seg.micros.length;
  const hasFlags = seg.collision !== "auto" || seg.highFatMeal !== "auto" || seg.seedOil || seg.notes;
  const hasFtn = segId === "ftn" && seg.ftnMode;
  return !!(hasItems || hasFlags || hasFtn);
}

function clearSegmentContents(seg, segId){
  seg.proteins = [];
  seg.carbs = [];
  seg.fats = [];
  seg.micros = [];
  seg.collision = "auto";
  seg.highFatMeal = "auto";
  seg.seedOil = "";
  seg.notes = "";
  if(segId === "ftn") seg.ftnMode = "";
}

function syncSegmentStatus(seg, segId){
  const hasContent = segmentHasContent(seg, segId);
  if(hasContent){
    seg.status = "logged";
    return;
  }
  if(seg.status !== "none"){
    seg.status = "unlogged";
  }
}

function toggleSegmentItem(dateKey, segId, category, itemId){
  const day = getDay(dateKey);
  const seg = day.segments[segId];
  if(!seg) return;

  const arr = seg[category];
  const idx = arr.indexOf(itemId);
  if(idx >= 0) arr.splice(idx, 1);
  else arr.push(itemId);

  syncSegmentStatus(seg, segId);

  const nowIso = new Date().toISOString();
  touchSegment(seg, nowIso);
  touchDay(day, nowIso);

  setDay(dateKey, day);
}

function setSegmentStatus(dateKey, segId, status){
  const day = getDay(dateKey);
  const seg = day.segments[segId];
  if(!seg) return;
  if(status !== "unlogged" && status !== "none" && status !== "logged") return;
  if(seg.status === status) return;

  if(status === "none" || status === "unlogged"){
    clearSegmentContents(seg, segId);
    seg.status = status;
  }else{
    seg.status = "logged";
    syncSegmentStatus(seg, segId);
  }

  const nowIso = new Date().toISOString();
  touchSegment(seg, nowIso);
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

function setDayField(dateKey, field, value){
  const day = getDay(dateKey);
  if(day[field] === value) return;
  day[field] = value;
  touchDay(day);
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
  for(const dk of Object.keys(state.logs)){
    const day = getDay(dk);
    for(const seg of Object.values(day.segments)){
      const arr = seg[category];
      if(Array.isArray(arr)){
        const j = arr.indexOf(itemId);
        if(j >= 0) arr.splice(j, 1);
      }
    }
    state.logs[dk] = day;
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

function exportState(){
  const json = serializeExport(state, { appVersion: APP_VERSION, now: new Date() });
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `shredmaxx_solar_log_${yyyyMmDd(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
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
  state.settings = { ...state.settings, ...nextSettings };
  persistSettings().catch(e => console.error("Persist settings failed:", e));
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

function mergeLogs(baseLogs, incomingLogs){
  const out = { ...(baseLogs || {}) };
  if(!incomingLogs || typeof incomingLogs !== "object") return out;

  for(const [dateKey, nextDay] of Object.entries(incomingLogs)){
    if(out[dateKey]){
      out[dateKey] = mergeDay(out[dateKey], nextDay);
    }else{
      out[dateKey] = nextDay;
    }
  }

  return out;
}

function validateImportPayload(payload){
  if(!payload || typeof payload !== "object"){
    return { ok: false, error: "Import failed: payload must be an object." };
  }

  const version = payload.version;
  if(version === 4){
    const result = validateV4Import(payload);
    if(!result.ok){
      return { ok: false, error: result.errors?.[0] || "Import failed: invalid v4 payload.", version: 4 };
    }
    return { ok: true, legacy: false, version: 4 };
  }
  if(version && version !== 3){
    return { ok: false, error: `Unsupported import version ${version}.`, version };
  }

  if(payload.logs && typeof payload.logs !== "object"){
    return { ok: false, error: "Import failed: logs must be an object keyed by date." };
  }

  return {
    ok: true,
    legacy: true,
    version: version || 3
  };
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
  if(mode === "replace"){
    state = next;
    await persistAll();
    return { ok: true, mode: "replace", version: validation.version, legacy: validation.legacy };
  }

  const merged = {
    ...state,
    rosters: mergeRosters(state.rosters, next.rosters, { dedupeByLabel: true }),
    logs: mergeLogs(state.logs, next.logs)
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
    setDayField,
    toggleBoolField,
    addRosterItem,
    removeRosterItem,
    updateRosterLabel,
    updateRosterAliases,
    updateRosterTags,
    toggleRosterPinned: toggleRosterPinnedAction,
    toggleRosterArchived: toggleRosterArchivedAction,
    exportState,
    importState,
    validateImportPayload,
    applyImportPayload,
    replaceState,
    updateSettings,
    toggleFocusMode,
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
