// @ts-check

import { selectTodayVm } from "../vm/index.js";
import { computeInsights } from "../../domain/insights.js";

export function renderTodayScreen({
  els,
  state,
  dateKey,
  getDay,
  setDay,
  actions,
  dateFromKey,
  renderTimeline,
  renderRituals,
  renderScales,
  renderSupplements,
  wireNotes,
  applyHomeRedaction
}){
  const vm = selectTodayVm(state, dateKey);
  const day = vm.day || getDay(dateKey);
  if(!state.logs[dateKey]){
    setDay(dateKey, day);
  }

  if(els.copyYesterday){
    const canCopy = actions.canCopyYesterday ? actions.canCopyYesterday(dateKey) : false;
    els.copyYesterday.disabled = !canCopy;
  }

  renderTimeline(dateKey, day);
  renderRituals(dateKey);
  renderScales(dateKey);
  renderSupplements(dateKey);
  const todayNudgeInsight = renderTodayNudge({ els, state, dateKey, dateFromKey });
  wireNotes(dateKey);
  applyHomeRedaction();

  return { todayNudgeInsight };
}

function renderTodayNudge({ els, state, dateKey, dateFromKey }){
  if(!els.todayNudge) return null;
  const settings = state.settings || {};
  if(!settings.nudgesEnabled){
    els.todayNudge.hidden = true;
    return null;
  }

  const insights = computeInsights({
    state,
    anchorDate: dateFromKey(dateKey),
    includeDay: true,
    includeWeek: false
  }).filter((insight) => insight.scope === "day");

  const pick = insights[0];
  if(!pick){
    els.todayNudge.hidden = true;
    return null;
  }

  els.todayNudge.hidden = false;
  if(els.todayNudgeTitle) els.todayNudgeTitle.textContent = pick.title || "Insight";
  if(els.todayNudgeMessage) els.todayNudgeMessage.textContent = pick.message || "";
  if(els.todayNudgeReason) els.todayNudgeReason.textContent = pick.reason ? `Reason: ${pick.reason}` : "";
  return pick;
}
