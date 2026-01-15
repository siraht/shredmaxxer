// @ts-check

import { effectiveSegmentFlags, normalizeTri } from "../../domain/heuristics.js";
import { computeRecents } from "../../domain/recents.js";

export function createSegmentEditor({
  els,
  getState,
  getDay,
  getSegmentDefs,
  setCurrentSegmentId,
  formatRange,
  escapeHtml,
  renderChipSet,
  getRosterSearch,
  setRosterSearch
}) {
  function ensureRosterSearch() {
    let search = getRosterSearch();
    if (!search || typeof search !== "object") {
      search = { proteins: "", carbs: "", fats: "", micros: "" };
      setRosterSearch(search);
    }
    return search;
  }

  function setSegmentedActive(root, value) {
    if (!root) return;
    const btns = [...root.querySelectorAll(".seg-btn")];
    btns.forEach((btn) => btn.classList.toggle("active", btn.dataset.value === value));
  }

  function updateSheetHints(dateKey, segId) {
    if (!els.flagHelp) return;
    const day = getDay(dateKey);
    const seg = day.segments[segId];
    if (!seg) return;

    const state = getState();
    const effective = effectiveSegmentFlags(seg, state.rosters);

    if (effective.seedOilHint && seg.seedOil !== "yes" && seg.seedOil !== "none") {
      els.flagHelp.textContent = "⚠️ Potential seed oils detected in fats. Check tags.";
      els.flagHelp.classList.add("warn-text");
    } else {
      els.flagHelp.textContent = "Collision auto = fat:dense + carb:starch. High‑fat auto = fat:dense.";
      els.flagHelp.classList.remove("warn-text");
    }
  }

  function updateSegmentProgress(dateKey, segId) {
    if (!els.sheetProgress) return;
    const day = getDay(dateKey);
    const seg = day.segments[segId];
    if (!seg) return;
    const filled = [
      Array.isArray(seg.proteins) && seg.proteins.length,
      Array.isArray(seg.carbs) && seg.carbs.length,
      Array.isArray(seg.fats) && seg.fats.length,
      Array.isArray(seg.micros) && seg.micros.length
    ].filter(Boolean).length;
    const bars = [...els.sheetProgress.querySelectorAll("span")];
    const activeBars = Math.min(bars.length, Math.max(0, Math.ceil((filled / 4) * bars.length)));
    bars.forEach((bar, idx) => bar.classList.toggle("on", idx < activeBars));
  }

  function refreshSegmentStatus(dateKey, segId) {
    const day = getDay(dateKey);
    const seg = day.segments[segId];
    if (!seg || !els.segStatus) return;
    setSegmentedActive(els.segStatus, seg.status || "unlogged");
    updateSegmentProgress(dateKey, segId);
  }

  function openSegment(dateKey, segId) {
    setCurrentSegmentId(segId);

    const state = getState();
    const defs = getSegmentDefs(state.settings);
    const def = defs.find((d) => d.id === segId);
    const day = getDay(dateKey);
    const seg = day.segments[segId];

    els.sheetTitle.textContent = def ? def.label : segId.toUpperCase();
    const range = def ? formatRange(def.start, def.end) : "";
    const tag = def ? def.sub : "";
    const last = seg.tsLast ? ` • logged ${new Date(seg.tsLast).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "";
    els.sheetSub.textContent = `${tag}${last}`;
    if (els.sheetWindowLabel) {
      els.sheetWindowLabel.textContent = (def && def.sub) ? def.sub.toUpperCase() : "WINDOW";
    }
    if (els.sheetWindowTime) {
      els.sheetWindowTime.textContent = range || "—";
    }

    els.ftnModeRow.classList.toggle("hidden", segId !== "ftn");
    if (segId === "ftn") {
      setSegmentedActive(els.ftnModeSeg, seg.ftnMode || "");
    }

    setSegmentedActive(els.segCollision, normalizeTri(seg.collision));
    setSegmentedActive(els.segHighFat, normalizeTri(seg.highFatMeal));
    setSegmentedActive(els.segSeedOil, seg.seedOil || "");
    setSegmentedActive(els.segStatus, seg.status || "unlogged");
    els.segNotes.value = seg.notes || "";

    const rosterSearch = ensureRosterSearch();
    els.searchProteins.value = rosterSearch.proteins || "";
    els.searchCarbs.value = rosterSearch.carbs || "";
    els.searchFats.value = rosterSearch.fats || "";
    els.searchMicros.value = rosterSearch.micros || "";

    const recents = {
      proteins: computeRecents(state.logs, "proteins", { limit: 8 }),
      carbs: computeRecents(state.logs, "carbs", { limit: 8 }),
      fats: computeRecents(state.logs, "fats", { limit: 8 }),
      micros: computeRecents(state.logs, "micros", { limit: 8 })
    };

    renderChipSet(els.chipsProteins, state.rosters.proteins, seg.proteins, rosterSearch.proteins, escapeHtml, { sectioned: true, recents: recents.proteins });
    renderChipSet(els.chipsCarbs, state.rosters.carbs, seg.carbs, rosterSearch.carbs, escapeHtml, { sectioned: true, recents: recents.carbs });
    renderChipSet(els.chipsFats, state.rosters.fats, seg.fats, rosterSearch.fats, escapeHtml, { sectioned: true, recents: recents.fats });
    renderChipSet(els.chipsMicros, state.rosters.micros, seg.micros, rosterSearch.micros, escapeHtml, { sectioned: true, recents: recents.micros });

    updateSheetHints(dateKey, segId);
    updateSegmentProgress(dateKey, segId);

    els.sheet.classList.remove("hidden");
    els.sheet.setAttribute("aria-hidden", "false");
    if (els.closeSheet) {
      requestAnimationFrame(() => els.closeSheet.focus());
    }
  }

  function closeSegment() {
    els.sheet.classList.add("hidden");
    els.sheet.setAttribute("aria-hidden", "true");
    setCurrentSegmentId(null);
  }

  return {
    openSegment,
    closeSegment,
    refreshSegmentStatus,
    updateSheetHints,
    setSegmentedActive
  };
}
