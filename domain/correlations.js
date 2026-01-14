// @ts-check

import { computeDayCoverage } from "./coverage.js";

/**
 * @typedef {Object} CorrelationGroup
 * @property {string} label
 * @property {number} count
 * @property {number|null} avg
 */

/**
 * @typedef {Object} CorrelationEntry
 * @property {string} id
 * @property {string} metric
 * @property {string} label
 * @property {CorrelationGroup} a
 * @property {CorrelationGroup} b
 * @property {number} total
 */

function toSignalNumber(value){
  const n = Number.parseInt(value, 10);
  if(Number.isFinite(n) && n >= 1 && n <= 5) return n;
  return null;
}

function average(values){
  if(!values.length) return null;
  const total = values.reduce((sum, v) => sum + v, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function collectMetricGroups(logs, dateKeys, rosters, predicate, metricKey){
  const a = [];
  const b = [];
  const list = Array.isArray(dateKeys) ? dateKeys : [];

  for(const key of list){
    const day = logs?.[key];
    if(!day) continue;
    const metric = toSignalNumber(day?.[metricKey]);
    if(metric == null) continue;
    const bucket = predicate(day, rosters) ? a : b;
    bucket.push(metric);
  }

  return { a, b };
}

/**
 * Compute correlations for Review (local-only, descriptive).
 * @param {Record<string, any>} logs
 * @param {any} rosters
 * @param {string[]} dateKeys
 * @returns {CorrelationEntry[]}
 */
export function computeReviewCorrelations(logs, rosters, dateKeys){
  const list = Array.isArray(dateKeys) ? dateKeys : [];

  const collisionPredicate = (day, rosterData) => {
    const coverage = computeDayCoverage(day || {}, rosterData);
    return !!coverage.flags.collision;
  };

  const seedOilPredicate = (day, rosterData) => {
    const coverage = computeDayCoverage(day || {}, rosterData);
    return !!coverage.flags.seedOil;
  };

  const strictPredicate = (day) => {
    const mode = day?.segments?.ftn?.ftnMode || "";
    return mode === "ftn" || mode === "strict";
  };

  const offPredicate = (day) => {
    const mode = day?.segments?.ftn?.ftnMode || "";
    return mode === "off";
  };

  const collisionGroups = collectMetricGroups(logs, list, rosters, collisionPredicate, "cravings");
  const seedOilGroups = collectMetricGroups(logs, list, rosters, seedOilPredicate, "cravings");
  const strictGroups = collectMetricGroups(logs, list, rosters, strictPredicate, "energy");
  const offGroups = collectMetricGroups(logs, list, rosters, offPredicate, "energy");

  const entries = [];

  entries.push({
    id: "cravings-collision",
    metric: "Cravings",
    label: "Cravings vs collision days",
    a: { label: "Collision days", count: collisionGroups.a.length, avg: average(collisionGroups.a) },
    b: { label: "No collision", count: collisionGroups.b.length, avg: average(collisionGroups.b) },
    total: collisionGroups.a.length + collisionGroups.b.length
  });

  entries.push({
    id: "cravings-seed-oil",
    metric: "Cravings",
    label: "Cravings vs seed‑oil days",
    a: { label: "Seed‑oil days", count: seedOilGroups.a.length, avg: average(seedOilGroups.a) },
    b: { label: "No seed oils", count: seedOilGroups.b.length, avg: average(seedOilGroups.b) },
    total: seedOilGroups.a.length + seedOilGroups.b.length
  });

  entries.push({
    id: "energy-ftn",
    metric: "Energy",
    label: "Energy on FTN strict vs off days",
    a: { label: "FTN strict", count: strictGroups.a.length, avg: average(strictGroups.a) },
    b: { label: "FTN off", count: offGroups.a.length, avg: average(offGroups.a) },
    total: strictGroups.a.length + offGroups.a.length
  });

  return entries;
}

export default {
  computeReviewCorrelations
};
