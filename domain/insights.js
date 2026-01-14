// @ts-check

import { buildTagIndex, hasTag } from "./flags.js";
import { effectiveSegmentFlags } from "./heuristics.js";
import { dateToKey } from "./time.js";
import { getWeekDateKeys } from "./weekly.js";

/**
 * @typedef {"day"|"week"} InsightScope
 * @typedef {Object} Insight
 * @property {string} id
 * @property {string} ruleId
 * @property {InsightScope} scope
 * @property {string} scopeKey
 * @property {string} title
 * @property {string} message
 * @property {string} reason
 * @property {"info"|"nudge"|"warn"} tone
 */

/**
 * @typedef {Object} InsightsState
 * @property {{
 *  day: Record<string, Record<string, string>>,
 *  week: Record<string, Record<string, string>>
 * }} dismissed
 */

function phasePrefix(phase){
  if(phase === "strict") return "Strict phase: ";
  if(phase === "maintenance") return "Maintenance: ";
  if(phase === "advanced") return "Advanced: ";
  return "";
}

function normalizeInsightsState(input){
  const base = {
    dismissed: {
      day: {},
      week: {}
    }
  };
  if(!input || typeof input !== "object"){
    return base;
  }
  const dismissed = input.dismissed && typeof input.dismissed === "object" ? input.dismissed : {};
  return {
    dismissed: {
      day: dismissed.day && typeof dismissed.day === "object" ? dismissed.day : {},
      week: dismissed.week && typeof dismissed.week === "object" ? dismissed.week : {}
    }
  };
}

/**
 * @returns {InsightsState}
 */
export function createInsightsState(){
  return normalizeInsightsState({});
}

/**
 * Build a stable insight id.
 * @param {InsightScope} scope
 * @param {string} scopeKey
 * @param {string} ruleId
 */
export function buildInsightId(scope, scopeKey, ruleId){
  return `${scope}:${scopeKey}:${ruleId}`;
}

/**
 * @param {InsightsState} insightsState
 * @param {Insight} insight
 */
export function isInsightDismissed(insightsState, insight){
  const state = normalizeInsightsState(insightsState);
  const scopeBucket = state.dismissed?.[insight.scope] || {};
  const scopeMap = scopeBucket?.[insight.scopeKey] || {};
  return !!scopeMap?.[insight.ruleId];
}

/**
 * Dismiss an insight for its scope.
 * @param {InsightsState} insightsState
 * @param {Insight} insight
 * @param {Date} [now]
 * @returns {InsightsState}
 */
export function dismissInsight(insightsState, insight, now){
  const state = normalizeInsightsState(insightsState);
  const ts = (now instanceof Date ? now : new Date()).toISOString();
  const scope = insight.scope;
  const scopeKey = insight.scopeKey;
  const ruleId = insight.ruleId;
  const scopeBucket = { ...(state.dismissed?.[scope] || {}) };
  const scopeMap = { ...(scopeBucket?.[scopeKey] || {}) };
  scopeMap[ruleId] = ts;
  scopeBucket[scopeKey] = scopeMap;
  return {
    dismissed: {
      ...state.dismissed,
      [scope]: scopeBucket
    }
  };
}

/**
 * Merge two insights states (dismissed maps). Keeps most recent timestamps.
 * @param {InsightsState} base
 * @param {InsightsState} incoming
 * @returns {InsightsState}
 */
export function mergeInsightsState(base, incoming){
  const a = normalizeInsightsState(base);
  const b = normalizeInsightsState(incoming);

  const mergeScope = (scope) => {
    const out = { ...(a.dismissed?.[scope] || {}) };
    const bScope = b.dismissed?.[scope] || {};
    for(const [scopeKey, rules] of Object.entries(bScope)){
      const existing = out[scopeKey] || {};
      const merged = { ...existing };
      for(const [ruleId, ts] of Object.entries(rules || {})){
        const prev = existing?.[ruleId];
        if(!prev){
          merged[ruleId] = ts;
        }else{
          const prevMs = Date.parse(prev);
          const nextMs = Date.parse(ts);
          if(Number.isFinite(nextMs) && (nextMs >= (Number.isFinite(prevMs) ? prevMs : -1))){
            merged[ruleId] = ts;
          }
        }
      }
      out[scopeKey] = merged;
    }
    return out;
  };

  return {
    dismissed: {
      day: mergeScope("day"),
      week: mergeScope("week")
    }
  };
}

function buildLabelMap(rosters){
  const map = new Map();
  const cats = ["proteins", "carbs", "fats", "micros", "supplements"];
  for(const cat of cats){
    const list = Array.isArray(rosters?.[cat]) ? rosters[cat] : [];
    for(const item of list){
      if(item && item.id){
        map.set(item.id, item.label || item.id);
      }
    }
  }
  return map;
}

function segmentHasAnyItems(segment){
  if(!segment) return false;
  return ["proteins", "carbs", "fats", "micros"].some((k) => (segment?.[k]?.length || 0) > 0);
}

/**
 * Compute insights for a single day.
 * @param {{
 *  day:any,
 *  dateKey:string,
 *  rosters:any,
 *  settings:any
 * }} params
 * @returns {Insight[]}
 */
export function computeDayInsights(params){
  const day = params.day || {};
  const dateKey = params.dateKey;
  const rosters = params.rosters || {};
  const phase = params.settings?.phase || "";
  const prefix = phasePrefix(phase);
  const tagIndex = buildTagIndex(rosters);
  const labelMap = buildLabelMap(rosters);
  /** @type {Insight[]} */
  const insights = [];

  const lunch = day?.segments?.lunch;
  if(day?.trained && lunch && (lunch.status === "logged" || segmentHasAnyItems(lunch))){
    const hasStarch = hasTag(lunch.carbs, "carb:starch", tagIndex);
    if(!hasStarch){
      const ruleId = "training_starch_lunch";
      insights.push({
        id: buildInsightId("day", dateKey, ruleId),
        ruleId,
        scope: "day",
        scopeKey: dateKey,
        title: "Post-training starch",
        message: `${prefix}Training logged — add a starch carb at lunch to support recovery.`,
        reason: "Training logged + lunch has no carb:starch tags.",
        tone: "nudge"
      });
    }
  }

  const segIds = ["ftn", "lunch", "dinner", "late"];
  let collisionSeg = "";
  let collisionSource = "";
  for(const segId of segIds){
    const seg = day?.segments?.[segId];
    if(!seg) continue;
    const flags = effectiveSegmentFlags(seg, rosters);
    if(flags.collision.value){
      collisionSeg = segId;
      collisionSource = flags.collision.source;
      break;
    }
  }
  if(collisionSeg){
    const ruleId = "collision_today";
    const segLabel = collisionSeg.charAt(0).toUpperCase() + collisionSeg.slice(1);
    const sourceLabel = collisionSource === "auto" ? "auto" : "manual";
    insights.push({
      id: buildInsightId("day", dateKey, ruleId),
      ruleId,
      scope: "day",
      scopeKey: dateKey,
      title: "Collision logged",
      message: `${prefix}Collision logged today — tomorrow, separate starch + dense fat.`,
      reason: `${segLabel} collision flagged (${sourceLabel}).`,
      tone: "warn"
    });
  }

  if(day?.segments?.ftn?.ftnMode === "off" && day?.segments?.ftn?.status === "logged"){
    const ruleId = "ftn_off_today";
    insights.push({
      id: buildInsightId("day", dateKey, ruleId),
      ruleId,
      scope: "day",
      scopeKey: dateKey,
      title: "FTN off",
      message: `${prefix}FTN was off today — consider a lite or strict FTN tomorrow if energy allows.`,
      reason: "FTN mode set to off.",
      tone: "info"
    });
  }

  // Example: seed oil hint if fat tags indicate seed oil but seedOil flag not set.
  for(const segId of segIds){
    const seg = day?.segments?.[segId];
    if(!seg) continue;
    const seedOilTagged = hasTag(seg?.fats, "fat:seed_oil", tagIndex);
    if(seedOilTagged && seg?.seedOil !== "yes"){
      const items = (seg?.fats || []).map((id) => labelMap.get(id) || id).slice(0, 2);
      const label = items.length ? ` (${items.join(", ")})` : "";
      const ruleId = "seed_oil_hint";
      insights.push({
        id: buildInsightId("day", dateKey, ruleId),
        ruleId,
        scope: "day",
        scopeKey: dateKey,
        title: "Seed oil check",
        message: `${prefix}Seed-oil-tagged fat selected${label}. Confirm seed-oil exposure.`,
        reason: "fat:seed_oil tag detected without seedOil flag.",
        tone: "info"
      });
      break;
    }
  }

  return insights;
}

function pickMicrosForSuggestion(rosters){
  const list = Array.isArray(rosters?.micros) ? rosters.micros : [];
  const pinned = list.filter((item) => item && item.pinned && !item.archived);
  const others = list.filter((item) => item && !item.archived && !item.pinned);
  const picks = [...pinned, ...others].slice(0, 2);
  return picks.map((item) => item.label || item.id);
}

/**
 * Compute insights for the week containing anchorDate.
 * @param {{
 *  logs: Record<string, any>,
 *  rosters:any,
 *  settings:any,
 *  anchorDate: Date
 * }} params
 * @returns {Insight[]}
 */
export function computeWeekInsights(params){
  const logs = params.logs || {};
  const rosters = params.rosters || {};
  const settings = params.settings || {};
  const anchor = params.anchorDate instanceof Date ? params.anchorDate : new Date();
  const weekStart = Number.isFinite(settings.weekStart) ? settings.weekStart : 0;
  const dateKeys = getWeekDateKeys(anchor, weekStart);
  const weekKey = dateKeys[0] || dateToKey(anchor);
  const phase = settings.phase || "";
  const prefix = phasePrefix(phase);

  let loggedDays = 0;
  let microCount = 0;
  const microsSet = new Set();

  for(const key of dateKeys){
    const day = logs?.[key];
    if(!day || typeof day !== "object") continue;
    loggedDays += 1;
    const segments = day?.segments || {};
    for(const seg of Object.values(segments)){
      const micros = Array.isArray(seg?.micros) ? seg.micros : [];
      micros.forEach((id) => microsSet.add(id));
    }
  }
  microCount = microsSet.size;

  /** @type {Insight[]} */
  const insights = [];

  if(loggedDays > 0 && microCount === 0){
    const picks = pickMicrosForSuggestion(rosters);
    const pickLabel = picks.length ? ` Try: ${picks.join(" + ")}.` : "";
    const ruleId = "week_no_micros";
    insights.push({
      id: buildInsightId("week", weekKey, ruleId),
      ruleId,
      scope: "week",
      scopeKey: weekKey,
      title: "Add micros",
      message: `${prefix}No μ logged this week.${pickLabel}`.trim(),
      reason: "Weekly μ count is 0.",
      tone: "nudge"
    });
  }

  return insights;
}

/**
 * Compute insights and filter dismissed.
 * @param {{
 *  state:any,
 *  anchorDate?:Date,
 *  includeDay?:boolean,
 *  includeWeek?:boolean
 * }} params
 * @returns {Insight[]}
 */
export function computeInsights(params){
  const state = params.state || {};
  const anchorDate = params.anchorDate instanceof Date ? params.anchorDate : new Date();
  const dateKey = dateToKey(anchorDate);
  const includeDay = params.includeDay !== false;
  const includeWeek = params.includeWeek !== false;
  let insights = [];

  if(includeDay){
    insights = insights.concat(computeDayInsights({
      day: state?.logs?.[dateKey],
      dateKey,
      rosters: state?.rosters,
      settings: state?.settings
    }));
  }

  if(includeWeek){
    insights = insights.concat(computeWeekInsights({
      logs: state?.logs || {},
      rosters: state?.rosters,
      settings: state?.settings,
      anchorDate
    }));
  }

  const insightsState = normalizeInsightsState(state?.insights);
  return insights.filter((insight) => !isInsightDismissed(insightsState, insight));
}

export default {
  createInsightsState,
  buildInsightId,
  isInsightDismissed,
  dismissInsight,
  mergeInsightsState,
  computeDayInsights,
  computeWeekInsights,
  computeInsights
};
