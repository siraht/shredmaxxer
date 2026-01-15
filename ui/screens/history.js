// @ts-check

import { selectHistoryVm } from "../vm/index.js";
import { effectiveSegmentFlags, normalizeTri } from "../../domain/heuristics.js";

export function renderHistoryScreen({
  els,
  state,
  escapeHtml,
  formatSnapshotTime,
  openDays,
  filters,
  page,
  pageSize
}) {
  const vm = selectHistoryVm(state);
  if (els.historySearch && filters) {
    els.historySearch.value = filters.query || "";
  }
  if (els.historyFilters && filters) {
    els.historyFilters.querySelectorAll("[data-filter]").forEach((btn) => {
      const key = btn.dataset.filter || "";
      btn.classList.toggle("active", !!filters.flags?.[key]);
    });
  }
  const rosterIndex = new Map();
  const rosters = state.rosters || {};
  const rosterCats = ["proteins", "carbs", "fats", "micros", "supplements"];
  for (const cat of rosterCats) {
    const list = Array.isArray(rosters[cat]) ? rosters[cat] : [];
    for (const item of list) {
      if (item && item.id) rosterIndex.set(item.id, item);
    }
  }

  const query = String(filters?.query || "").trim().toLowerCase();
  const tokens = query ? query.split(/\s+/).map((t) => t.replace(/^tag:/, "").replace(/^#/, "")).filter(Boolean) : [];
  const activeFlags = filters?.flags || {};
  const syncMeta = state.meta?.sync || {};
  const syncModeLabel = state.settings?.sync?.mode === "off"
    ? "Paused"
    : (syncMeta.status === "syncing" ? "Syncing" : (syncMeta.status === "error" ? "Error" : (syncMeta.status === "offline" ? "Offline" : "Idle")));
  const hasPending = Number.isFinite(syncMeta.pendingOutbox) && syncMeta.pendingOutbox > 0;
  const redacted = !!state.settings?.privacy?.redactHome;
  const openSet = openDays instanceof Set ? openDays : new Set();

  const formatWeekday = (dateKey) => {
    const d = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d).toUpperCase();
  };

  const signalLevel = (value) => {
    const num = Number.parseInt(String(value || ""), 10);
    if (Number.isFinite(num) && num > 0) return Math.min(5, Math.max(1, num));
    return 0;
  };

  const buildSearchText = (day, issues) => {
    const parts = [];
    if (!redacted && day?.notes) parts.push(String(day.notes));
    const segments = day?.segments || {};
    for (const seg of Object.values(segments)) {
      if (!seg || typeof seg !== "object") continue;
      if (!redacted && seg.notes) parts.push(String(seg.notes));
      const cats = ["proteins", "carbs", "fats", "micros"];
      for (const cat of cats) {
        const ids = Array.isArray(seg[cat]) ? seg[cat] : [];
        for (const id of ids) {
          const item = rosterIndex.get(id);
          if (!item) continue;
          parts.push(item.label || "");
          if (Array.isArray(item.aliases)) parts.push(item.aliases.join(" "));
          if (Array.isArray(item.tags)) parts.push(item.tags.join(" "));
        }
      }
    }
    if (issues?.collision) parts.push("collision");
    if (issues?.seedOil) parts.push("seed oil", "seed-oil", "seedoil");
    if (issues?.highFat) parts.push("high fat", "high-fat", "highfat");
    return parts.join(" ").toLowerCase();
  };

  const hasNotes = (day) => {
    if (day?.notes && String(day.notes).trim()) return true;
    if (day?.supplements?.notes && String(day.supplements.notes).trim()) return true;
    for (const seg of Object.values(day?.segments || {})) {
      if (seg?.notes && String(seg.notes).trim()) return true;
    }
    return false;
  };

  const filtered = vm.items.filter((item) => {
    const day = state.logs?.[item.dateKey];
    if (!day) return false;
    if (tokens.length) {
      const text = buildSearchText(day, item.issues);
      if (!tokens.every((token) => text.includes(token))) return false;
    }
    if (activeFlags.collision && !item.issues?.collision) return false;
    if (activeFlags.seedOil && !item.issues?.seedOil) return false;
    if (activeFlags.highFat && !item.issues?.highFat) return false;
    if (activeFlags.notes && !hasNotes(day)) return false;
    return true;
  });

  const limit = (page || 1) * (pageSize || 10);
  const items = filtered.slice(0, limit);

  els.historyList.innerHTML = items.map((item) => {
    // ... rest of item mapping (already mostly the same) ...
    const k = item.dateKey;
    const all = item.counts || { proteins: 0, carbs: 0, fats: 0, micros: 0 };
    const issues = item.issues || { collision: false, seedOil: false, highFat: false };
    const filled = [all.proteins > 0, all.carbs > 0, all.fats > 0, all.micros > 0].filter(Boolean).length;
    const progress = Math.round((filled / 4) * 100);
    const day = state.logs?.[k] || {};
    const signals = item.signals || {};
    const dayOpen = openSet.has(k);
    const edited = item.lastEdited ? formatSnapshotTime?.(item.lastEdited) || item.lastEdited : "";
    const detailId = `detail-${k}`;
    const showDetails = dayOpen && !redacted;
    const detailLabel = showDetails ? "Hide" : "Details";
    const notesValue = redacted ? "" : escapeHtml(day.notes || "");
    const highFatState = normalizeTri(day.highFatDay);
    const segs = day.segments || {};
    return `
      <div class="day-item" data-date="${escapeHtml(k)}">
        <div class="day-marker"><span></span></div>
        <div class="day-card">
          <div class="day-head">
            <div class="day-meta">
              <div class="day-kicker">${escapeHtml(formatWeekday(k))}</div>
              <div class="day-date">${escapeHtml(k)}</div>
            </div>
            <div class="day-badges">
              ${issues.collision ? `<span class="issue-flag bad">×</span>` : ""}
              ${issues.seedOil ? `<span class="issue-flag warn">⚠</span>` : ""}
              ${issues.highFat ? `<span class="issue-flag good">◎</span>` : ""}
              ${hasPending ? `<span class="issue-flag sync">SYNC</span>` : ""}
              <button class="btn ghost tinybtn" type="button" data-action="toggle-details" data-date="${escapeHtml(k)}" aria-controls="${escapeHtml(detailId)}" aria-expanded="${showDetails ? "true" : "false"}">${detailLabel}</button>
              <button class="btn ghost tinybtn" type="button" data-action="open-day" data-date="${escapeHtml(k)}">Open</button>
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
                <div class="day-signal" style="--level:${signalLevel(signals.energy)}">
                  <span>E</span>
                  <span class="day-signal-bar"><span></span></span>
                </div>
                <div class="day-signal" style="--level:${signalLevel(signals.mood)}">
                  <span>M</span>
                  <span class="day-signal-bar"><span></span></span>
                </div>
                <div class="day-signal" style="--level:${signalLevel(signals.cravings)}">
                  <span>C</span>
                  <span class="day-signal-bar"><span></span></span>
                </div>
              </div>
            </div>
          </div>
          <div class="day-detail" id="${escapeHtml(detailId)}" ${showDetails ? "" : "hidden"}>
            <div class="day-detail-header">
              <div>Last edited: ${escapeHtml(edited || "—")} • Sync: ${escapeHtml(syncModeLabel)}</div>
              <div class="day-detail-actions">
                <button class="btn ghost small" type="button" data-action="copy-prev" data-date="${escapeHtml(k)}">Copy prev day</button>
                <button class="btn ghost small" type="button" data-action="open-day" data-date="${escapeHtml(k)}">Open in Today</button>
              </div>
            </div>
            <div class="day-detail-grid">
              <div class="day-detail-block">
                <div class="day-detail-label">Toggles</div>
                <div class="row gap wrap">
                  <button class="day-toggle ${day.movedBeforeLunch ? "active" : ""}" type="button" data-action="toggle-bool" data-field="movedBeforeLunch" data-date="${escapeHtml(k)}">Moved before lunch</button>
                  <button class="day-toggle ${day.trained ? "active" : ""}" type="button" data-action="toggle-bool" data-field="trained" data-date="${escapeHtml(k)}">Trained</button>
                </div>
                <div class="segmented small mt" data-field="highFatDay" data-date="${escapeHtml(k)}">
                  <button class="seg-btn ${highFatState === "auto" ? "active" : ""}" type="button" data-action="set-tri" data-field="highFatDay" data-value="auto" data-date="${escapeHtml(k)}">Auto</button>
                  <button class="seg-btn ${highFatState === "yes" ? "active" : ""}" type="button" data-action="set-tri" data-field="highFatDay" data-value="yes" data-date="${escapeHtml(k)}">Yes</button>
                  <button class="seg-btn ${highFatState === "no" ? "active" : ""}" type="button" data-action="set-tri" data-field="highFatDay" data-value="no" data-date="${escapeHtml(k)}">No</button>
                </div>
              </div>
              <div class="day-detail-block">
                <div class="day-detail-label">Signals</div>
                <div class="segmented small mt" data-field="energy" data-date="${escapeHtml(k)}">
                  ${["1", "2", "3", "4", "5"].map((v) => `<button class="seg-btn ${String(day.energy || "") === v ? "active" : ""}" type="button" data-action="set-signal" data-field="energy" data-value="${v}" data-date="${escapeHtml(k)}">${v}</button>`).join("")}
                </div>
                <div class="segmented small mt" data-field="mood" data-date="${escapeHtml(k)}">
                  ${["1", "2", "3", "4", "5"].map((v) => `<button class="seg-btn ${String(day.mood || "") === v ? "active" : ""}" type="button" data-action="set-signal" data-field="mood" data-value="${v}" data-date="${escapeHtml(k)}">${v}</button>`).join("")}
                </div>
                <div class="segmented small mt" data-field="cravings" data-date="${escapeHtml(k)}">
                  ${["1", "2", "3", "4", "5"].map((v) => `<button class="seg-btn ${String(day.cravings || "") === v ? "active" : ""}" type="button" data-action="set-signal" data-field="cravings" data-value="${v}" data-date="${escapeHtml(k)}">${v}</button>`).join("")}
                </div>
              </div>
              <div class="day-detail-block">
                <div class="day-detail-label">Notes</div>
                <textarea class="day-detail-notes" data-action="set-notes" data-field="notes" data-date="${escapeHtml(k)}" placeholder="Day notes...">${notesValue}</textarea>
              </div>
            </div>
            <div class="day-detail-block">
              <div class="day-detail-label">Segments</div>
              ${["ftn", "lunch", "dinner", "late"].map((segId) => {
      const seg = segs[segId] || {};
      const flags = effectiveSegmentFlags(seg, rosters);
      const status = seg.status || "unlogged";
      const counts = {
        P: Array.isArray(seg.proteins) ? seg.proteins.length : 0,
        C: Array.isArray(seg.carbs) ? seg.carbs.length : 0,
        F: Array.isArray(seg.fats) ? seg.fats.length : 0,
        M: Array.isArray(seg.micros) ? seg.micros.length : 0
      };
      const notesOn = !!(seg.notes && String(seg.notes).trim());
      return `
                  <div class="segment-summary" data-date="${escapeHtml(k)}" data-seg="${escapeHtml(segId)}">
                    <div>
                      <div class="segment-summary-title">${escapeHtml(segId)}</div>
                      <div class="segment-summary-meta">
                        <span>Status: ${escapeHtml(status)}</span>
                        <span>P${counts.P} • C${counts.C} • F${counts.F} • μ${counts.M}</span>
                        ${notesOn ? `<span>Notes</span>` : ""}
                      </div>
                    </div>
                    <div class="segment-summary-flags">
                      ${flags.collision.value ? `<span class="flag bad">×</span>` : ""}
                      ${seg.seedOil === "yes" ? `<span class="flag warn">⚠</span>` : ""}
                      ${flags.highFatMeal.value ? `<span class="flag good">◎</span>` : ""}
                      <button class="btn ghost tinybtn" type="button" data-action="edit-seg" data-date="${escapeHtml(k)}" data-seg="${escapeHtml(segId)}">Edit</button>
                    </div>
                  </div>
                `;
    }).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (els.historyLoadMore) {
    const hasMore = filtered.length > limit;
    els.historyLoadMore.hidden = !hasMore;
    els.historyLoadMore.textContent = `Load more (${filtered.length - limit} remaining)`;
  }

  if (els.exportBtn) {
    const encDefault = !!(state.settings?.privacy && state.settings.privacy.exportEncryptedByDefault);
    const primaryMode = encDefault ? "encrypted" : "plain";
    const altMode = encDefault ? "plain" : "encrypted";
    els.exportBtn.textContent = encDefault ? "Export encrypted" : "Export JSON";
    els.exportBtn.dataset.mode = primaryMode;
    if (els.exportAltBtn) {
      els.exportAltBtn.textContent = encDefault ? "Export JSON" : "Export encrypted";
      els.exportAltBtn.dataset.mode = altMode;
      els.exportAltBtn.hidden = false;
    }
  }
}
