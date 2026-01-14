// @ts-check

import { createKeyedMemo, rosterVersion } from "./memo.js";
import { isDayIndexFresh } from "../../domain/indexes.js";
import { mergeDayDiversity, countIssues } from "../legacy_helpers.js";

const memo = createKeyedMemo();

/**
 * @param {any} state
 */
export function selectHistoryVm(state){
  const logs = state.logs || {};
  const rosters = state.rosters || {};
  const dayIndex = state.dayIndex || {};
  const keys = Object.keys(logs).sort().reverse();
  const list = keys.slice(0, 30);
  const rostersVer = rosterVersion(rosters);
  const items = list.map((dateKey) => {
    const day = logs[dateKey];
    const version = `${day?.rev || 0}|${rostersVer}`;
    return memo(dateKey, version, () => {
      const cached = dayIndex?.[dateKey];
      if(cached && isDayIndexFresh(cached, day)){
        return { dateKey, counts: cached.counts, issues: cached.flags };
      }
      const counts = mergeDayDiversity(day);
      const issues = countIssues(day, rosters);
      return { dateKey, counts, issues };
    });
  });
  return { items };
}
