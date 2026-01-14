// @ts-check

import { selectHistoryVm } from "../vm/index.js";

export function renderHistoryScreen({ els, state, escapeHtml, onSelectDay }){
  const vm = selectHistoryVm(state);

  els.historyList.innerHTML = vm.items.map((item) => {
    const k = item.dateKey;
    const all = item.counts;
    const issues = item.issues;
    return `
      <div class="day-item" data-date="${k}">
        <div class="left">
          <div class="d">${escapeHtml(k)}</div>
          <div class="s">P${all.proteins} • C${all.carbs} • F${all.fats} • μ${all.micros}</div>
        </div>
        <div class="right">
        ${issues.collision ? "×" : ""}
        ${issues.seedOil ? "⚠" : ""}
        ${issues.highFat ? "◎" : ""}
        <span>›</span>
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
