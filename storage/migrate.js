// @ts-check

import { createRosterItem, normalizeLabel, generateId } from "../domain/roster.js";
import { createInsightsState } from "../domain/insights.js";
import { createDefaultRosters, findDefaultRosterTemplate } from "../domain/roster_defaults.js";
import { normalizeTri } from "../domain/heuristics.js";

export const DEFAULT_SETTINGS = {
  dayStart: "06:00",
  dayEnd: "23:59",
  ftnEnd: "12:00",
  lunchEnd: "16:00",
  dinnerEnd: "21:00",
  focusMode: "nowfade",
  sunMode: "manual",
  sunrise: "07:00",
  sunset: "17:00",
  phase: "",
  weekStart: 0,
  nudgesEnabled: false,
  supplementsMode: "none",
  lastKnownLat: undefined,
  lastKnownLon: undefined,
  sync: {
    mode: "hosted",
    endpoint: "/api/sync/v1",
    encryption: "none",
    pushDebounceMs: 1200,
    pullOnBoot: true
  },
  ui: {
    accent: "",
    reduceEffects: false
  },
  privacy: {
    appLock: false,
    redactHome: false,
    exportEncryptedByDefault: false,
    blurOnBackground: false
  }
};

/**
 * @typedef {Object} MigrateOptions
 * @property {Date} [now]
 * @property {string} [installId]
 * @property {string} [appVersion]
 * @property {"idb"|"localStorage"} [storageMode]
 * @property {""|"unknown"|"granted"|"denied"} [persistStatus]
 */

function safeString(value, fallback){
  return typeof value === "string" ? value : fallback;
}

function isAllowedStatus(status){
  return status === "" || status === "unlogged" || status === "none" || status === "logged";
}

/**
 * @param {any} seg
 * @returns {string}
 */
function deriveSegmentStatus(seg){
  const hasItems = ["proteins", "carbs", "fats", "micros"].some((k) => (seg?.[k]?.length || 0) > 0);
  const hasFlags = !!seg?.seedOil || (seg?.collision && seg?.collision !== "auto") || (seg?.highFatMeal && seg?.highFatMeal !== "auto");
  const hasNotes = !!seg?.notes;
  const hasFtn = !!seg?.ftnMode;
  return (hasItems || hasFlags || hasNotes || hasFtn) ? "logged" : "unlogged";
}

/**
 * @param {any} settings
 * @returns {any}
 */
function mergeSettings(settings){
  const base = { ...DEFAULT_SETTINGS };
  if(settings && typeof settings === "object"){
    const merged = {
      ...base,
      ...settings,
      privacy: { ...base.privacy, ...(settings.privacy || {}) },
      sync: { ...base.sync, ...(settings.sync || {}) },
      ui: { ...base.ui, ...(settings.ui || {}) }
    };
    if(merged.privacy && Object.prototype.hasOwnProperty.call(merged.privacy, "appLockHash")){
      delete merged.privacy.appLockHash;
    }
    return merged;
  }
  return base;
}

/**
 * @param {any} v3State
 * @returns {boolean}
 */
function hasAnyRosterLabels(v3State){
  const rosters = v3State?.rosters || {};
  return ["proteins", "carbs", "fats", "micros"].some((cat) => Array.isArray(rosters[cat]) && rosters[cat].length > 0);
}

/**
 * @param {any} v3State
 * @returns {boolean}
 */
function hasAnyLogLabels(v3State){
  const logs = v3State?.logs || {};
  for(const day of Object.values(logs)){
    const segments = day?.segments || {};
    for(const seg of Object.values(segments)){
      for(const key of ["proteins", "carbs", "fats", "micros"]){
        if(Array.isArray(seg?.[key]) && seg[key].length > 0) return true;
      }
    }
  }
  return false;
}

/**
 * Migrate v3 state to v4 schema.
 * @param {any} v3State
 * @param {MigrateOptions} [options]
 * @returns {any}
 */
export function migrateV3ToV4(v3State, options = {}){
  const now = options.now instanceof Date ? options.now : new Date();
  const isoNow = now.toISOString();

  const settings = mergeSettings(v3State?.settings);

  const rosters = {
    proteins: [],
    carbs: [],
    fats: [],
    micros: [],
    supplements: []
  };

  const labelMaps = {
    proteins: new Map(),
    carbs: new Map(),
    fats: new Map(),
    micros: new Map(),
    supplements: new Map()
  };

  const addLabel = (category, label) => {
    const normalized = normalizeLabel(label);
    if(!normalized) return "";
    const key = normalized.toLowerCase();
    const map = labelMaps[category];
    if(map.has(key)) return map.get(key);
    const template = findDefaultRosterTemplate(category, normalized);
    const tags = template?.tags || [];
    const item = createRosterItem(normalized, { tags, now });
    rosters[category].push(item);
    map.set(key, item.id);
    return item.id;
  };

  const v3Rosters = v3State?.rosters || {};
  for(const cat of ["proteins", "carbs", "fats", "micros"]){
    const list = Array.isArray(v3Rosters[cat]) ? v3Rosters[cat] : [];
    list.forEach((label) => addLabel(cat, label));
  }

  const logs = {};
  const v3Logs = v3State?.logs || {};
  for(const [dateKey, day] of Object.entries(v3Logs)){
    const baseSegments = {
      ftn: { ftnMode: "", status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 },
      lunch: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 },
      dinner: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 },
      late: { status: "unlogged", proteins: [], carbs: [], fats: [], micros: [], collision: "auto", highFatMeal: "auto", seedOil: "", notes: "", tsFirst: "", tsLast: "", rev: 0 }
    };

    const segments = { ...baseSegments };
    const v3Segments = day?.segments || {};

    for(const segId of Object.keys(baseSegments)){
      const source = v3Segments[segId] || {};
      const mapped = { ...segments[segId] };
      mapped.ftnMode = segId === "ftn" ? safeString(source.ftnMode, "") : undefined;
      mapped.collision = normalizeTri(source.collision ?? "auto");
      mapped.highFatMeal = normalizeTri(source.highFatMeal ?? "auto");
      mapped.seedOil = safeString(source.seedOil, "");
      mapped.notes = safeString(source.notes, "");
      mapped.tsFirst = safeString(source.tsFirst, "");
      mapped.tsLast = safeString(source.tsLast, "");
      mapped.rev = Number.isFinite(source.rev) ? source.rev : 0;

      mapped.proteins = (Array.isArray(source.proteins) ? source.proteins : []).map((label) => addLabel("proteins", label)).filter(Boolean);
      mapped.carbs = (Array.isArray(source.carbs) ? source.carbs : []).map((label) => addLabel("carbs", label)).filter(Boolean);
      mapped.fats = (Array.isArray(source.fats) ? source.fats : []).map((label) => addLabel("fats", label)).filter(Boolean);
      mapped.micros = (Array.isArray(source.micros) ? source.micros : []).map((label) => addLabel("micros", label)).filter(Boolean);

      if(isAllowedStatus(source.status)){
        mapped.status = source.status;
      }else{
        mapped.status = deriveSegmentStatus(mapped);
      }

      segments[segId] = mapped;
    }

    const tsCreated = safeString(day?.tsCreated, isoNow);
    const tsLast = safeString(day?.tsLast, tsCreated || isoNow);

    logs[dateKey] = {
      segments,
      supplements: { mode: "none", items: [], notes: "", tsLast: "" },
      movedBeforeLunch: !!day?.movedBeforeLunch,
      trained: !!day?.trained,
      highFatDay: normalizeTri(day?.highFatDay),
      energy: safeString(day?.energy, ""),
      mood: safeString(day?.mood, ""),
      cravings: safeString(day?.cravings, ""),
      notes: safeString(day?.notes, ""),
      tsCreated,
      tsLast,
      rev: Number.isFinite(day?.rev) ? day.rev : 0
    };
  }

  const shouldUseDefaults = !hasAnyRosterLabels(v3State) && !hasAnyLogLabels(v3State);
  const finalRosters = shouldUseDefaults ? createDefaultRosters(now) : rosters;

  return {
    version: 4,
    meta: {
      version: 4,
      installId: options.installId || generateId(),
      appVersion: options.appVersion || v3State?.meta?.appVersion || "",
      storageMode: options.storageMode || "localStorage",
      persistStatus: options.persistStatus || "unknown"
    },
    settings,
    rosters: finalRosters,
    insights: createInsightsState(),
    logs
  };
}

export default migrateV3ToV4;
