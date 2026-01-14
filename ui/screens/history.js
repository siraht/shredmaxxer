// @ts-check

import { selectHistoryVm } from "../vm/index.js";

export function renderHistoryScreen({ els, state, escapeHtml, onSelectDay }){
  const vm = selectHistoryVm(state);

  els.historyList.innerHTML = vm.items.map((item) => {
    const k = item.dateKey;
    const all = item.counts || { proteins: 0, carbs: 0, fats: 0, micros: 0 };
    const issues = item.issues || { collision: false, seedOil: false, highFat: false };
    const filled = [
      all.proteins > 0,
      all.carbs > 0,
      all.fats > 0,
      all.micros > 0
    ].filter(Boolean).length;
    const progress = Math.round((filled / 4) * 100);
    const clampLevel = (value) => Math.max(0, Math.min(3, Number(value) || 0));
    const pLevel = clampLevel(all.proteins);
    const cLevel = clampLevel(all.carbs);
    const fLevel = clampLevel(all.fats);
    return `
      <div class="day-item" data-date="${escapeHtml(k)}">
        <div class="day-marker"><span></span></div>
        <div class="day-card">
          <div class="day-head">
            <div class="day-meta">
              <div class="day-kicker">Cycle</div>
              <div class="day-date">${escapeHtml(k)}</div>
            </div>
            <div class="day-badges">
              ${issues.collision ? `<span class="issue-flag bad">×</span>` : ""}
              ${issues.seedOil ? `<span class="issue-flag warn">⚠</span>` : ""}
              ${issues.highFat ? `<span class="issue-flag good">◎</span>` : ""}
              <span class="day-chevron">›</span>
            </div>
          </div>
          <div class="day-body">
            <div class="day-arc" data-progress="${progress}">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <path class="arc-track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3"></path>
                <path class="arc-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3" stroke-dasharray="${progress}, 100"></path>
              </svg>
            </div>
            <div class="day-summary">
              <div class="day-counts">P${all.proteins} • C${all.carbs} • F${all.fats} • μ${all.micros}</div>
              <div class="day-signals">
                <div class="day-signal" style="--level:${pLevel}">
                  <span>P</span>
                  <span class="day-signal-bar"><span></span></span>
                </div>
                <div class="day-signal" style="--level:${cLevel}">
                  <span>C</span>
                  <span class="day-signal-bar"><span></span></span>
                </div>
                <div class="day-signal" style="--level:${fLevel}">
                  <span>F</span>
                  <span class="day-signal-bar"><span></span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  els.historyList.querySelectorAll(".day-item").forEach((el) => {
    el.addEventListener("click", () => {
      const k = el.dataset.date;
      if(typeof onSelectDay === "function"){
        onSelectDay(k);
      }
    });
  });

  if(els.exportBtn){
    const encDefault = !!(state.settings?.privacy && state.settings.privacy.exportEncryptedByDefault);
    const primaryMode = encDefault ? "encrypted" : "plain";
    const altMode = encDefault ? "plain" : "encrypted";
    els.exportBtn.textContent = encDefault ? "Export encrypted" : "Export JSON";
    els.exportBtn.dataset.mode = primaryMode;
    if(els.exportAltBtn){
      els.exportAltBtn.textContent = encDefault ? "Export JSON" : "Export encrypted";
      els.exportAltBtn.dataset.mode = altMode;
      els.exportAltBtn.hidden = false;
    }
  }
}
