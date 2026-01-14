// @ts-check

export function wireSegmentEditor({
  els,
  actions,
  getCurrentDate,
  getCurrentSegmentId,
  openSegment,
  closeSegment,
  refreshSegmentStatus,
  updateSegmentVisual,
  updateSheetHints,
  setSegmentedActive,
  getRosterSearch,
  setRosterSearch,
  searchInputs,
  captureUndo,
  markViewDirty,
  queueRender,
  yyyyMmDd,
  setSegNotesTimer,
  logPerf
}){
  // sheet close
  els.sheetBackdrop.addEventListener("click", closeSegment);
  els.closeSheet.addEventListener("click", closeSegment);
  els.doneSegment.addEventListener("click", closeSegment);

  const sheetPanel = els.sheet?.querySelector(".sheet-panel");
  const isSheetOpen = () => !els.sheet?.classList.contains("hidden");
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const notifyHistoryChange = () => {
    markViewDirty("history");
    if(els.viewHistory && !els.viewHistory.classList.contains("hidden")){
      queueRender("main");
    }
  };

  document.addEventListener("keydown", (e) => {
    if(!isSheetOpen()) return;
    if(e.key === "Escape"){
      e.preventDefault();
      closeSegment();
      return;
    }
    if(e.key !== "Tab" || !sheetPanel) return;
    const nodes = [...sheetPanel.querySelectorAll(focusableSelector)]
      .filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true" && el.offsetParent !== null);
    if(nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if(e.shiftKey && document.activeElement === first){
      e.preventDefault();
      last.focus();
    }else if(!e.shiftKey && document.activeElement === last){
      e.preventDefault();
      first.focus();
    }
  });

  // sheet clear
  els.clearSegment.addEventListener("click", () => {
    const currentSegmentId = getCurrentSegmentId();
    if(!currentSegmentId) return;
    const dateKey = yyyyMmDd(getCurrentDate());
    captureUndo("Segment cleared", () => actions.clearSegment(dateKey, currentSegmentId));
    openSegment(dateKey, currentSegmentId);
    updateSegmentVisual(dateKey, currentSegmentId);
    notifyHistoryChange();
  });

  const wireChipContainer = (container, category) => {
    let longPressTimer = null;
    let longPressFired = false;

    const clearLongPress = () => {
      if(longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = null;
    };

    container.addEventListener("pointerdown", (e) => {
      if(e.button !== undefined && e.button !== 0) return;
      const btn = e.target.closest(".chip");
      if(!btn) return;
      if(btn.dataset.add === "1") return;
      const item = btn.dataset.item;
      if(!item) return;
      longPressFired = false;
      clearLongPress();
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        btn.dataset.longpress = "1";
        captureUndo("Roster pin toggled", () => actions.toggleRosterPinned(category, item));
        markViewDirty("settings");
        queueRender("main");
        const currentSegmentId = getCurrentSegmentId();
        if(currentSegmentId){
          openSegment(yyyyMmDd(getCurrentDate()), currentSegmentId);
        }
      }, 520);
    });

    container.addEventListener("pointerup", clearLongPress);
    container.addEventListener("pointerleave", clearLongPress);
    container.addEventListener("pointercancel", clearLongPress);

    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if(!btn) return;
      if(longPressFired || btn.dataset.longpress === "1"){
        longPressFired = false;
        btn.dataset.longpress = "";
        return;
      }
      const dateKey = yyyyMmDd(getCurrentDate());
      const currentSegmentId = getCurrentSegmentId();
      if(!currentSegmentId) return;

      if(btn.dataset.add === "1"){
        const label = btn.dataset.label;
        if(!label) return;
        const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
        captureUndo("Item added", () => {
          const entry = actions.addRosterItem(category, label);
          if(entry && entry.id){
            actions.toggleSegmentItem(dateKey, currentSegmentId, category, entry.id);
          }
        });
        const rosterSearch = getRosterSearch();
        if(rosterSearch && rosterSearch[category] !== undefined){
          rosterSearch[category] = "";
          setRosterSearch(rosterSearch);
        }
        const input = searchInputs[category];
        if(input) input.value = "";
        openSegment(dateKey, currentSegmentId);
        markViewDirty("settings");
        queueRender("main");
        notifyHistoryChange();
        if(typeof logPerf === "function" && t0){
          logPerf("chip_add", ((typeof performance !== "undefined" && performance.now) ? performance.now() - t0 : 0), { category });
        }
        return;
      }

      const item = btn.dataset.item;
      if(!item) return;
      const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
      captureUndo("Segment updated", () => actions.toggleSegmentItem(dateKey, currentSegmentId, category, item));
      btn.classList.toggle("active");
      refreshSegmentStatus(dateKey, currentSegmentId);
      updateSegmentVisual(dateKey, currentSegmentId);
      updateSheetHints(dateKey, currentSegmentId);
      notifyHistoryChange();
      if(typeof logPerf === "function" && t0){
        logPerf("chip_toggle", ((typeof performance !== "undefined" && performance.now) ? performance.now() - t0 : 0), { category, item, segId: currentSegmentId });
      }
    });
  };

  wireChipContainer(els.chipsProteins, "proteins");
  wireChipContainer(els.chipsCarbs, "carbs");
  wireChipContainer(els.chipsFats, "fats");
  wireChipContainer(els.chipsMicros, "micros");

  const addFromSheet = (category) => {
    const name = prompt(`Add ${category} item:`);
    if(!name) return;

    captureUndo("Item added", () => actions.addRosterItem(category, name));

    const dateKey = yyyyMmDd(getCurrentDate());
    if(getCurrentSegmentId()){
      openSegment(dateKey, getCurrentSegmentId());
    }
    markViewDirty("settings");
    markViewDirty("today");
    queueRender("main");
  };

  els.addProtein.addEventListener("click", () => addFromSheet("proteins"));
  els.addCarb.addEventListener("click", () => addFromSheet("carbs"));
  els.addFat.addEventListener("click", () => addFromSheet("fats"));
  els.addMicro.addEventListener("click", () => addFromSheet("micros"));

  const wireSearchInput = (input, category) => {
    if(!input) return;
    input.addEventListener("input", () => {
      const rosterSearch = getRosterSearch();
      if(rosterSearch && rosterSearch[category] !== undefined){
        rosterSearch[category] = input.value || "";
        setRosterSearch(rosterSearch);
      }
      const currentSegmentId = getCurrentSegmentId();
      if(currentSegmentId){
        openSegment(yyyyMmDd(getCurrentDate()), currentSegmentId);
      }
    });
  };

  wireSearchInput(els.searchProteins, "proteins");
  wireSearchInput(els.searchCarbs, "carbs");
  wireSearchInput(els.searchFats, "fats");
  wireSearchInput(els.searchMicros, "micros");

  els.segCollision.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    const currentSegmentId = getCurrentSegmentId();
    if(!btn || !currentSegmentId) return;
    const dateKey = yyyyMmDd(getCurrentDate());
    const val = btn.dataset.value;
    setSegmentedActive(els.segCollision, val);
    captureUndo("Collision updated", () => actions.setSegmentField(dateKey, currentSegmentId, "collision", val));
    refreshSegmentStatus(dateKey, currentSegmentId);
    updateSegmentVisual(dateKey, currentSegmentId);
    updateSheetHints(dateKey, currentSegmentId);
    notifyHistoryChange();
  });

  els.segHighFat.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    const currentSegmentId = getCurrentSegmentId();
    if(!btn || !currentSegmentId) return;
    const dateKey = yyyyMmDd(getCurrentDate());
    const val = btn.dataset.value;
    setSegmentedActive(els.segHighFat, val);
    captureUndo("High-fat updated", () => actions.setSegmentField(dateKey, currentSegmentId, "highFatMeal", val));
    refreshSegmentStatus(dateKey, currentSegmentId);
    updateSegmentVisual(dateKey, currentSegmentId);
    notifyHistoryChange();
  });

  els.segSeedOil.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    const currentSegmentId = getCurrentSegmentId();
    if(!btn || !currentSegmentId) return;
    const dateKey = yyyyMmDd(getCurrentDate());
    const val = btn.dataset.value;
    setSegmentedActive(els.segSeedOil, val);
    captureUndo("Seed oil updated", () => actions.setSegmentField(dateKey, currentSegmentId, "seedOil", val));
    refreshSegmentStatus(dateKey, currentSegmentId);
    updateSegmentVisual(dateKey, currentSegmentId);
    updateSheetHints(dateKey, currentSegmentId);
    notifyHistoryChange();
  });

  els.segStatus.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    const currentSegmentId = getCurrentSegmentId();
    if(!btn || !currentSegmentId) return;
    const dateKey = yyyyMmDd(getCurrentDate());
    const val = btn.dataset.value;
    setSegmentedActive(els.segStatus, val);
    captureUndo("Status updated", () => actions.setSegmentStatus(dateKey, currentSegmentId, val));
    openSegment(dateKey, currentSegmentId);
    updateSegmentVisual(dateKey, currentSegmentId);
    notifyHistoryChange();
  });

  els.ftnModeSeg.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if(!btn) return;
    const dateKey = yyyyMmDd(getCurrentDate());
    setSegmentedActive(els.ftnModeSeg, btn.dataset.value);
    captureUndo("FTN mode updated", () => actions.setSegmentField(dateKey, "ftn", "ftnMode", btn.dataset.value));
    refreshSegmentStatus(dateKey, "ftn");
    updateSegmentVisual(dateKey, "ftn");
    notifyHistoryChange();
  });

  els.segNotes.addEventListener("input", () => {
    const currentSegmentId = getCurrentSegmentId();
    if(!currentSegmentId) return;
    const dateKey = yyyyMmDd(getCurrentDate());
    setSegNotesTimer(() => {
      captureUndo("Segment notes updated", () => actions.setSegmentField(dateKey, currentSegmentId, "notes", els.segNotes.value || ""));
      refreshSegmentStatus(dateKey, currentSegmentId);
      updateSegmentVisual(dateKey, currentSegmentId);
      notifyHistoryChange();
    }, 320);
  });

  return {};
}
