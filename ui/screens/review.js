// @ts-check

import { computeRotationPicks } from "../../domain/rotation.js";
import { computeInsights } from "../../domain/insights.js";
import { computeWeeklySummary, computeIssueFrequency, getWeekStartDate, getPhaseTargetLabel } from "../../domain/weekly.js";
import { computeReviewCorrelations } from "../../domain/correlations.js";
import { dateToKey } from "../../domain/time.js";
import { isWeekIndexFresh } from "../../domain/indexes.js";

export function renderReviewScreen({ els, state, anchorDate, escapeHtml, onMatrixSelect }){
  if(!els.coverageMatrix){
    return { insights: [] };
  }

  const rawWeekStart = state.settings.weekStart;
  const parsedWeekStart = Number.isFinite(rawWeekStart) ? rawWeekStart : Number.parseInt(rawWeekStart, 10);
  const weekStart = Number.isFinite(parsedWeekStart) && parsedWeekStart >= 0 && parsedWeekStart <= 6
    ? parsedWeekStart
    : 0;
  const anchor = anchorDate || new Date();
  let summary = null;
  const weekKey = dateToKey(getWeekStartDate(anchor, weekStart));
  const cachedWeek = state.weekIndex?.[weekKey];
  if(cachedWeek && cachedWeek.indexVersion === 1 && isWeekIndexFresh(cachedWeek, state.logs)){
    const dateKeys = Array.isArray(cachedWeek.dateKeys) ? cachedWeek.dateKeys : [];
    const cachedIssues = cachedWeek.issueFrequency;
    const useCachedIssues = cachedIssues && Number.isFinite(cachedIssues.collisionDays);
    summary = {
      dateKeys,
      uniqueCounts: cachedWeek.uniqueCounts || cachedWeek.counts,
      ftnSummary: cachedWeek.ftnSummary || cachedWeek.ftnModes,
      coverage: cachedWeek.coverage || cachedWeek.segmentCoverage,
      matrix: cachedWeek.matrix,
      issueFrequency: useCachedIssues ? cachedIssues : computeIssueFrequency(state.logs, dateKeys, state.rosters),
      correlations: cachedWeek.correlations || computeReviewCorrelations(state.logs, state.rosters, dateKeys),
      phaseLabel: cachedWeek.phaseLabel || getPhaseTargetLabel(state.settings.phase || "")
    };
  }else{
    summary = computeWeeklySummary({
      logs: state.logs,
      rosters: state.rosters,
      anchorDate: anchor,
      weekStart,
      phase: state.settings.phase || ""
    });
  }
  const dateKeys = summary.dateKeys || [];
  const matrix = summary.matrix || [];

  if(els.reviewRange){
    const start = dateKeys[0] || "—";
    const end = dateKeys[dateKeys.length - 1] || "—";
    els.reviewRange.textContent = `${start} → ${end}`;
  }

  if(els.reviewIssues){
    const issues = summary.issueFrequency || { collisionDays: 0, seedOilDays: 0, highFatMealDays: 0, highFatDayDays: 0 };
    const totalDays = dateKeys.length || 0;
    els.reviewIssues.innerHTML = `
      <div class="issue-chip">Collision days: ${issues.collisionDays}/${totalDays}</div>
      <div class="issue-chip">Seed‑oil days: ${issues.seedOilDays}/${totalDays}</div>
      <div class="issue-chip">High‑fat meals: ${issues.highFatMealDays}/${totalDays}</div>
      <div class="issue-chip">High‑fat days: ${issues.highFatDayDays}/${totalDays}</div>
    `;
  }

  if(els.reviewSummary){
    const counts = summary.uniqueCounts || { proteins: 0, carbs: 0, fats: 0, micros: 0 };
    const ftn = summary.ftnSummary || { strict: 0, lite: 0, off: 0, unset: 0, loggedDays: 0, days: 0 };
    els.reviewSummary.textContent = `Unique: P${counts.proteins} • C${counts.carbs} • F${counts.fats} • μ${counts.micros} • FTN strict ${ftn.strict}, lite ${ftn.lite}, off ${ftn.off}`;
  }
  if(els.reviewPhase){
    els.reviewPhase.textContent = summary.phaseLabel || "";
  }

  if(els.reviewCorrelations){
    const correlations = Array.isArray(summary.correlations) ? summary.correlations : [];
    const fmtAvg = (value) => (value == null ? "—" : value.toFixed(2));
    const rows = correlations.map((entry) => {
      const line = `${entry.a.label}: ${fmtAvg(entry.a.avg)} (n=${entry.a.count}) vs ${entry.b.label}: ${fmtAvg(entry.b.avg)} (n=${entry.b.count})`;
      return `
        <div class="corr-row">
          <div class="corr-title">${escapeHtml(entry.label)}</div>
          <div class="corr-line">${escapeHtml(line)} • Observed in last ${entry.total} days</div>
        </div>
      `;
    }).join("");
    els.reviewCorrelations.innerHTML = rows || `<div class="tiny muted">No correlations yet.</div>`;
  }

  let insights = [];
  if(els.reviewInsights){
    insights = computeInsights({ state, anchorDate: anchor, includeDay: true, includeWeek: true });
    const dayInsights = insights.filter((entry) => entry.scope === "day");
    const weekInsights = insights.filter((entry) => entry.scope === "week");
    const toneLabel = (tone) => {
      if(tone === "warn") return "Warn";
      if(tone === "nudge") return "Nudge";
      return "Info";
    };
    const renderCard = (entry) => {
      const tone = entry.tone || "info";
      return `
        <div class="insight-card tone-${escapeHtml(tone)}">
          <div class="insight-header">
            <div class="insight-meta">${escapeHtml(toneLabel(tone))}</div>
            <button class="btn ghost tinybtn" data-action="dismiss-insight" data-insight-id="${escapeHtml(entry.id)}" type="button">Dismiss</button>
          </div>
          <div class="insight-title">${escapeHtml(entry.title || "")}</div>
          <div class="insight-message">${escapeHtml(entry.message || "")}</div>
          <div class="insight-reason">Reason: ${escapeHtml(entry.reason || "")}</div>
        </div>
      `;
    };
    const renderGroup = (label, items) => `
      <div class="insight-group">
        <div class="insight-group-title">${escapeHtml(label)}</div>
        ${items.map(renderCard).join("")}
      </div>
    `;
    const blocks = [];
    if(dayInsights.length){
      blocks.push(renderGroup(`Day • ${dayInsights[0].scopeKey}`, dayInsights));
    }
    if(weekInsights.length){
      blocks.push(renderGroup(`Week of ${weekInsights[0].scopeKey}`, weekInsights));
    }
    els.reviewInsights.innerHTML = blocks.join("") || `<div class="tiny muted">No insights yet.</div>`;
  }

  const head = `
    <div class="matrix-row matrix-head">
      <div class="matrix-date">Day</div>
      <div class="matrix-cell">P</div>
      <div class="matrix-cell">C</div>
      <div class="matrix-cell">F</div>
      <div class="matrix-cell">μ</div>
      <div class="matrix-cell">×</div>
      <div class="matrix-cell">⚠</div>
      <div class="matrix-cell">◎</div>
    </div>
  `;

  const rows = matrix.map((row) => {
    const cell = (value, col) => {
      const empty = value === 0 || value === "—";
      const content = (value === 0) ? "—" : value;
      const cls = empty ? "matrix-cell empty" : "matrix-cell";
      return `<div class="${cls}" data-col="${col}">${content}</div>`;
    };
    const flag = (on, glyph, col) => `<div class="matrix-cell flag ${on ? "on" : "empty"}" data-col="${col}">${on ? glyph : "—"}</div>`;
    return `
      <div class="matrix-row" data-date="${escapeHtml(row.dateKey)}">
        <div class="matrix-date">${escapeHtml(row.dateKey)}</div>
        ${cell(row.counts.proteins, "proteins")}
        ${cell(row.counts.carbs, "carbs")}
        ${cell(row.counts.fats, "fats")}
        ${cell(row.counts.micros, "micros")}
        ${flag(row.flags.collision, "×", "collision")}
        ${flag(row.flags.seedOil, "⚠", "seedOil")}
        ${flag(row.flags.highFat, "◎", "highFat")}
      </div>
    `;
  }).join("");

  els.coverageMatrix.innerHTML = head + rows;
  els.coverageMatrix.querySelectorAll(".matrix-row[data-date]").forEach((row) => {
    row.addEventListener("click", (event) => {
      const key = row.dataset.date;
      if(!key) return;
      const target = event.target.closest(".matrix-cell");
      const col = target?.dataset?.col || "";
      if(typeof onMatrixSelect === "function"){
        onMatrixSelect(key, col);
      }
    });
  });

  if(els.rotationPicks){
    const picks = computeRotationPicks({ rosters: state.rosters, logs: state.logs }, { limitPerCategory: 2, dateKeys });
    const tagMap = {
      proteins: "[High P]",
      carbs: "[Fuel]",
      fats: "[Sat Fat]",
      micros: "[Micro]"
    };
    const list = Object.keys(tagMap).flatMap((cat) => {
      const items = picks[cat] || [];
      return items.map((item) => ({ cat, item }));
    });
    if(!list.length){
      els.rotationPicks.innerHTML = `<div class="tiny muted">No picks yet</div>`;
    }else{
      els.rotationPicks.innerHTML = list.map((entry, idx) => `
        <div class="pick-row ${idx === 0 ? "active" : ""}" data-cat="${escapeHtml(entry.cat)}">
          <div class="pick-chevron">›</div>
          <div class="pick-meta">
            <div class="pick-text">Try: <span>${escapeHtml(entry.item.label || entry.item.id || "")}</span></div>
            <div class="pick-tag">${tagMap[entry.cat]}</div>
          </div>
        </div>
      `).join("");
    }
  }

  return { insights };
}
