// @ts-check

import { createKeyedMemo, rosterVersion } from "./memo.js";
import { effectiveHighFatDay, effectiveSegmentFlags } from "../../domain/heuristics.js";

const memo = createKeyedMemo();

/**
 * @param {any} state
 * @param {string} dateKey
 */
export function selectTodayVm(state, dateKey){
  const day = state.logs?.[dateKey] || null;
  const rosters = state.rosters || {};
  const settingsVersion = JSON.stringify(state.settings || {});
  const rostersVer = rosterVersion(rosters);
  const version = `${day?.rev || 0}|${settingsVersion}|${rostersVer}`;
  return memo(dateKey, version, () => {
    const segments = day?.segments || {};
    const segmentIds = ["ftn", "lunch", "dinner", "late"];
    const segmentList = segmentIds.map((id) => {
      const seg = segments[id];
      const counts = {
        proteins: Array.isArray(seg?.proteins) ? seg.proteins.length : 0,
        carbs: Array.isArray(seg?.carbs) ? seg.carbs.length : 0,
        fats: Array.isArray(seg?.fats) ? seg.fats.length : 0,
        micros: Array.isArray(seg?.micros) ? seg.micros.length : 0
      };
      return {
        id,
        status: seg?.status || "unlogged",
        counts,
        flags: effectiveSegmentFlags(seg || {}, rosters)
      };
    });
    return {
      dateKey,
      day,
      settings: state.settings || {},
      rosters,
      segments: segmentList,
      highFatDay: day ? effectiveHighFatDay(day, rosters) : { value: false, source: "auto" }
    };
  });
}
