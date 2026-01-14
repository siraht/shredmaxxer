// @ts-check

import { effectiveSegmentFlags, normalizeTri } from "../domain/heuristics.js";
import { computeSegmentWindows } from "../domain/time.js";
import { searchRosterItems } from "../domain/search.js";
import { computeCoverageMatrix } from "../domain/coverage.js";
import { computeRotationPicks } from "../domain/rotation.js";
import { getWeekDateKeys } from "../domain/weekly.js";

export function createLegacyUI(ctx){
  const { els, helpers, actions, defaults } = ctx;
  const {
    parseTimeToMinutes,
    minutesToTime,
    fmtTime,
    escapeHtml,
    clamp,
    nowMinutes,
    yyyyMmDd,
    addDays,
    dateFromKey,
    getActiveDateKey
  } = helpers;

  const getState = ctx.getState;
  const getDay = ctx.getDay;
  const setDay = ctx.setDay;
  const getCurrentDate = ctx.getCurrentDate;
  const setCurrentDate = ctx.setCurrentDate;
  const getCurrentSegmentId = ctx.getCurrentSegmentId;
  const setCurrentSegmentId = ctx.setCurrentSegmentId;

  let segmentEls = {};
  let notesDebounce = null;
  let segNotesTimer = null;
  let pendingImport = null;
  let pendingImportName = "";
  let rosterSearch = {
    proteins: "",
    carbs: "",
    fats: "",
    micros: ""
  };
  let undoState = null;
  let undoTimer = null;

  function liftMinuteToTimeline(minute, start){
    return minute < start ? minute + 1440 : minute;
  }

  function cloneStateSnapshot(){
    const current = getState();
    if(typeof structuredClone === "function"){
      return structuredClone(current);
    }
    return JSON.parse(JSON.stringify(current));
  }

  function hideUndoToast(){
    if(!els.undoToast) return;
    els.undoToast.hidden = true;
  }

  function showUndoToast(label){
    if(!els.undoToast || !els.undoLabel) return;
    els.undoLabel.textContent = label || "Change saved";
    els.undoToast.hidden = false;
    if(undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      hideUndoToast();
    }, 5000);
  }

  function captureUndo(label, fn){
    const snapshot = cloneStateSnapshot();
    const result = fn();
    undoState = snapshot;
    showUndoToast(label);
    return result;
  }

  // --- View switching ---
  function setActiveTab(which){
    const map = {
      today: [els.tabToday, els.viewToday],
      history: [els.tabHistory, els.viewHistory],
      review: [els.tabReview, els.viewReview],
      settings: [els.tabSettings, els.viewSettings]
    };

    for(const [k, [tab, view]] of Object.entries(map)){
      const on = (k === which);
      tab.classList.toggle("tab-active", on);
      view.classList.toggle("hidden", !on);
    }
  }

  function getSegmentDefs(settings){
    const labels = {
      ftn: { label: "FTN", sub: "Carb window" },
      lunch: { label: "Lunch", sub: "Carb + protein" },
      dinner: { label: "Dinner", sub: "Protein + fat" },
      late: { label: "Late", sub: "Bed / damage control" }
    };
    return computeSegmentWindows(settings).map((win) => ({
      id: win.id,
      label: labels[win.id].label,
      sub: labels[win.id].sub,
      start: win.start,
      end: win.end
    }));
  }

  function whichSegment(minute, defs){
    for(const d of defs){
      if(minute >= d.start && minute < d.end) return d.id;
    }
    return defs[defs.length - 1].id;
  }

  // --- Timeline rendering ---
  function setSkyByTime(minuteNow, sunriseMin, sunsetMin){
    const state = getState();
    const settings = state.settings;

    // Basic phase model with one-hour shoulders around sunrise/sunset
    const dawnStart = sunriseMin - 60;
    const dawnEnd = sunriseMin + 60;
    const duskStart = sunsetMin - 60;
    const duskEnd = sunsetMin + 60;

    let phase = "Night";
    let skyA = "#050714", skyB = "#090b22", skyC = "#0d1238";
    let accent = "var(--sun)";
    let sub = "";

    if(minuteNow >= dawnStart && minuteNow < dawnEnd){
      phase = "Dawn";
      skyA = "#0a0a25";
      skyB = "#23104b";
      skyC = "#401636";
      accent = "var(--sunrise)";
      sub = `Sunrise ${fmtTime(settings.sunrise)}`;
    }else if(minuteNow >= dawnEnd && minuteNow < duskStart){
      phase = "Day";
      skyA = "#061026";
      skyB = "#081a34";
      skyC = "#0b1230";
      accent = "var(--sun)";
      sub = `Sunset ${fmtTime(settings.sunset)}`;
    }else if(minuteNow >= duskStart && minuteNow < duskEnd){
      phase = "Dusk";
      skyA = "#150a1b";
      skyB = "#2a0718";
      skyC = "#0a0a25";
      accent = "var(--sunset)";
      sub = `Sunset ${fmtTime(settings.sunset)}`;
    }else{
      phase = "Night";
      skyA = "#050714";
      skyB = "#070a1b";
      skyC = "#0b1030";
      accent = "var(--cyan)";
      sub = "Low light. Protect sleep.";
    }

    document.documentElement.style.setProperty("--skyA", skyA);
    document.documentElement.style.setProperty("--skyB", skyB);
    document.documentElement.style.setProperty("--skyC", skyC);

    // phase copy
    els.phaseLabel.textContent = phase;
    els.phaseSub.textContent = sub;

    // set focus dot color subtly
    els.toggleFocus.querySelector(".focus-dot").style.background = accent;
  }

  function computeArcPath(x1, x2, yBase, yPeak){
    const xm = (x1 + x2) / 2;
    return `M ${x1.toFixed(2)} ${yBase.toFixed(2)} Q ${xm.toFixed(2)} ${yPeak.toFixed(2)} ${x2.toFixed(2)} ${yBase.toFixed(2)}`;
  }

  function quadPoint(x1, x2, yBase, yPeak, t){
    // quadratic Bezier with control point in the middle; x becomes linear in t
    const x = x1 * (1 - t) + x2 * t;
    const y = (1 - t) * (1 - t) * yBase + 2 * (1 - t) * t * yPeak + t * t * yBase;
    return { x, y };
  }

  function formatRange(aMin, bMin){
    return `${minutesToTime(aMin)}–${minutesToTime(bMin)}`;
  }

  function segCounts(seg){
    return {
      P: seg.proteins.length,
      C: seg.carbs.length,
      F: seg.fats.length,
      M: seg.micros.length
    };
  }

  function renderTimeline(dateKey, day){
    const state = getState();
    const defs = getSegmentDefs(state.settings);
    const start = defs[0].start;
    const end = defs[defs.length - 1].end;
    const span = Math.max(1, end - start);

    // clear
    els.timelineTrack.innerHTML = "";
    segmentEls = {};

    // build segments
    for(const d of defs){
      const leftPct = ((d.start - start) / span) * 100;
      const widthPct = ((d.end - d.start) / span) * 100;

      const segEl = document.createElement("div");
      segEl.className = "segment";
      segEl.style.left = `${leftPct}%`;
      segEl.style.width = `${widthPct}%`;
      segEl.setAttribute("role", "button");
      segEl.setAttribute("tabindex", "0");
      segEl.dataset.segment = d.id;

      // content
      const title = document.createElement("div");
      title.className = "segment-title";
      title.textContent = d.label;

      const time = document.createElement("div");
      time.className = "segment-time";
      time.textContent = formatRange(d.start, d.end);

      const flags = document.createElement("div");
      flags.className = "seg-flags";
      flags.innerHTML = ""; // filled by updateSegmentVisual

      const bubbles = document.createElement("div");
      bubbles.className = "bubbles";
      bubbles.innerHTML = `
        <div class="bubble" data-b="P">P<span class="count" data-c="P"></span></div>
        <div class="bubble" data-b="C">C<span class="count" data-c="C"></span></div>
        <div class="bubble" data-b="F">F<span class="count" data-c="F"></span></div>
        <div class="bubble" data-b="M">μ<span class="count" data-c="M"></span></div>
      `;

      segEl.appendChild(title);
      segEl.appendChild(time);
      segEl.appendChild(flags);
      segEl.appendChild(bubbles);

      segEl.addEventListener("click", () => openSegment(dateKey, d.id));
      segEl.addEventListener("keydown", (e) => {
        if(e.key === "Enter" || e.key === " "){
          e.preventDefault();
          openSegment(dateKey, d.id);
        }
      });

      els.timelineTrack.appendChild(segEl);
      segmentEls[d.id] = segEl;

      updateSegmentVisual(dateKey, d.id);
    }

    // mark current segment if today
    if(dateKey === getActiveDateKey()){
      const now = nowMinutes();
      const nowLifted = liftMinuteToTimeline(now, start);
      const cur = whichSegment(nowLifted, defs);
      for(const d of defs){
        segmentEls[d.id]?.setAttribute("aria-current", d.id === cur ? "true" : "false");
      }
    }else{
      for(const d of defs){
        segmentEls[d.id]?.setAttribute("aria-current", "false");
      }
    }

    // solar arc
    renderSolarArc(dateKey);

    // focus fog
    applyFutureFog(dateKey);
  }

  function applyFutureFog(dateKey){
    const state = getState();
    const mode = state.settings.focusMode || "nowfade";
    els.focusLabel.textContent = (mode === "full") ? "Full day" : "Fade future";

    if(mode !== "nowfade" || dateKey !== getActiveDateKey()){
      els.futureFog.classList.remove("on");
      return;
    }

    // Fade future only if now is within timeline
    const defs = getSegmentDefs(state.settings);
    const start = defs[0].start;
    const end = defs[defs.length - 1].end;
    const now = nowMinutes();
    const nowLifted = liftMinuteToTimeline(now, start);
    if(nowLifted < start || nowLifted > end){
      els.futureFog.classList.remove("on");
      return;
    }
    els.futureFog.classList.add("on");
  }

  function renderSolarArc(dateKey){
    const state = getState();
    const defs = getSegmentDefs(state.settings);
    const start = defs[0].start;
    const end = defs[defs.length - 1].end;
    const span = Math.max(1, end - start);

    const sunriseMin = parseTimeToMinutes(state.settings.sunrise);
    const sunsetMin = parseTimeToMinutes(state.settings.sunset);
    const sunriseLifted = liftMinuteToTimeline(sunriseMin, start);
    const sunsetLifted = liftMinuteToTimeline(sunsetMin, start);
    const sunriseClamped = clamp(sunriseLifted, start, end);
    const sunsetClamped = clamp(sunsetLifted, start, end);

    // map sunrise/sunset to x in viewBox coordinates
    const W = 1000;
    const yBase = 210;
    const yPeak = 50;

    const xSunrise = clamp(((sunriseClamped - start) / span), 0, 1) * W;
    const xSunset = clamp(((sunsetClamped - start) / span), 0, 1) * W;

    const path = computeArcPath(xSunrise, xSunset, yBase, yPeak);
    els.sunArc.setAttribute("d", path);

    // sun position
    const isToday = (dateKey === getActiveDateKey());
    const tMin = isToday ? nowMinutes() : (start + Math.floor(span * 0.45));
    const tMinLocal = ((tMin % 1440) + 1440) % 1440;

    // sky theme
    setSkyByTime(tMinLocal, sunriseMin, sunsetMin);

    let sunX = xSunrise;
    let sunY = yBase;
    let showSun = false;

    if(sunsetMin > sunriseMin && tMinLocal >= sunriseMin && tMinLocal <= sunsetMin){
      const t = clamp((tMinLocal - sunriseMin) / (sunsetMin - sunriseMin), 0, 1);
      const p = quadPoint(xSunrise, xSunset, yBase, yPeak, t);
      sunX = p.x;
      sunY = p.y;
      showSun = true;
    }else{
      // keep it low on the horizon at night
      const before = (tMinLocal < sunriseMin);
      sunX = before ? xSunrise : xSunset;
      sunY = yBase;
      showSun = false;
    }

    els.sunDot.setAttribute("cx", sunX.toFixed(2));
    els.sunDot.setAttribute("cy", sunY.toFixed(2));
    els.sunGlow.setAttribute("cx", sunX.toFixed(2));
    els.sunGlow.setAttribute("cy", sunY.toFixed(2));
    els.sunGlow.setAttribute("r", showSun ? "34" : "20");
    els.sunGlow.style.opacity = showSun ? "1" : ".35";

    els.sunTime.setAttribute("x", sunX.toFixed(2));
    els.sunTime.setAttribute("y", (sunY - 18).toFixed(2));
    els.sunTime.textContent = isToday ? minutesToTime(nowMinutes()) : " ";

    // now marker on the timeline (HTML layer)
    renderNowMarker(dateKey);
  }

  function renderNowMarker(dateKey){
    if(dateKey !== getActiveDateKey()){
      els.nowMarker.style.display = "none";
      return;
    }

    const state = getState();
    const defs = getSegmentDefs(state.settings);
    const start = defs[0].start;
    const end = defs[defs.length - 1].end;
    const span = Math.max(1, end - start);

    const now = nowMinutes();
    const nowLifted = liftMinuteToTimeline(now, start);
    const pct = clamp((nowLifted - start) / span, 0, 1) * 100;

    els.nowMarker.style.display = "block";
    els.nowMarker.style.left = `${pct}%`;

    // update current segment highlight
    const cur = whichSegment(nowLifted, defs);
    for(const d of defs){
      segmentEls[d.id]?.setAttribute("aria-current", d.id === cur ? "true" : "false");
    }
  }

  function updateSegmentVisual(dateKey, segId){
    const day = getDay(dateKey);
    const seg = day.segments[segId];
    const el = segmentEls[segId];
    if(!el || !seg) return;

    const status = seg.status || "unlogged";
    el.classList.toggle("status-logged", status === "logged");
    el.classList.toggle("status-none", status === "none");
    el.classList.toggle("status-unlogged", status === "unlogged");

    // counts + bubble styles
    const counts = segCounts(seg);
    for(const k of ["P", "C", "F", "M"]){
      const b = el.querySelector(`.bubble[data-b="${k}"]`);
      const c = el.querySelector(`.count[data-c="${k}"]`);
      const n = counts[k];
      if(!b || !c) continue;

      if(n > 0){
        b.classList.remove("empty");
        c.textContent = String(n);
        c.style.display = "grid";
      }else{
        b.classList.add("empty");
        c.textContent = "";
        c.style.display = "none";
      }
    }

    // flags
    const flags = el.querySelector(".seg-flags");
    if(flags){
      const state = getState();
      const effective = effectiveSegmentFlags(seg, state.rosters);
      flags.innerHTML = "";
      if(effective.collision.value){
        const f = document.createElement("div");
        f.className = "flag bad";
        f.title = "HFHC collision";
        f.textContent = "×";
        flags.appendChild(f);
      }
      if(seg.seedOil === "yes"){
        const f = document.createElement("div");
        f.className = "flag warn";
        f.title = "Seed oils / unknown oils";
        f.textContent = "⚠";
        flags.appendChild(f);
      }
      if(effective.highFatMeal.value){
        const f = document.createElement("div");
        f.className = "flag good";
        f.title = "High-fat meal";
        f.textContent = "◎";
        flags.appendChild(f);
      }
    }

    // FTN label tweak
    if(segId === "ftn"){
      const titleEl = el.querySelector(".segment-title");
      if(titleEl){
        const mode = seg.ftnMode || "";
        titleEl.textContent = mode ? `FTN (${mode.toUpperCase()})` : "FTN";
      }
    }
  }

  // --- Sheet (segment editor) ---
  function openSegment(dateKey, segId){
    setCurrentSegmentId(segId);

    const state = getState();
    const defs = getSegmentDefs(state.settings);
    const def = defs.find(d => d.id === segId);
    const day = getDay(dateKey);
    const seg = day.segments[segId];

    // title/sub
    els.sheetTitle.textContent = def ? def.label : segId.toUpperCase();
    const range = def ? formatRange(def.start, def.end) : "";
    const tag = def ? def.sub : "";
    const last = seg.tsLast ? ` • logged ${new Date(seg.tsLast).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : "";
    els.sheetSub.textContent = `${tag} • ${range}${last}`;

    // FTN mode row only for FTN segment
    els.ftnModeRow.classList.toggle("hidden", segId !== "ftn");
    if(segId === "ftn"){
      setSegmentedActive(els.ftnModeSeg, seg.ftnMode || "");
    }

    // collision + high-fat + seed oil + status + notes
    setSegmentedActive(els.segCollision, normalizeTri(seg.collision));
    setSegmentedActive(els.segHighFat, normalizeTri(seg.highFatMeal));
    setSegmentedActive(els.segSeedOil, seg.seedOil || "");
    setSegmentedActive(els.segStatus, seg.status || "unlogged");
    els.segNotes.value = seg.notes || "";

    if(!rosterSearch){
      rosterSearch = { proteins: "", carbs: "", fats: "", micros: "" };
    }
    els.searchProteins.value = rosterSearch.proteins || "";
    els.searchCarbs.value = rosterSearch.carbs || "";
    els.searchFats.value = rosterSearch.fats || "";
    els.searchMicros.value = rosterSearch.micros || "";

    // render chips
    renderChipSet(els.chipsProteins, state.rosters.proteins, seg.proteins, rosterSearch.proteins);
    renderChipSet(els.chipsCarbs, state.rosters.carbs, seg.carbs, rosterSearch.carbs);
    renderChipSet(els.chipsFats, state.rosters.fats, seg.fats, rosterSearch.fats);
    renderChipSet(els.chipsMicros, state.rosters.micros, seg.micros, rosterSearch.micros);

    updateSheetHints(dateKey, segId);

    // show
    els.sheet.classList.remove("hidden");
    els.sheet.setAttribute("aria-hidden", "false");
  }

  function closeSegment(){
    els.sheet.classList.add("hidden");
    els.sheet.setAttribute("aria-hidden", "true");
    setCurrentSegmentId(null);
  }

  function renderChipSet(container, roster, selected, query){
    const selSet = new Set(selected);
    const normalized = String(query || "").trim();
    const rosterItems = (Array.isArray(roster) ? roster : [])
      .map((item) => {
        if(typeof item === "string"){
          return { id: item, label: item, pinned: false, archived: false, aliases: [] };
        }
        return item;
      })
      .filter((item) => item && !item.archived);

    const list = normalized
      ? searchRosterItems(rosterItems, normalized, { includeArchived: false, limit: 60 })
      : rosterItems.slice().sort((a, b) => {
        const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if(pin !== 0) return pin;
        return String(a.label || "").localeCompare(String(b.label || ""));
      });

    const chips = list.map(item => {
      const id = item.id || item.label || "";
      const label = item.label || id;
      const on = selSet.has(id);
      const pin = item.pinned ? " pinned" : "";
      return `<button type="button" class="chip ${on ? "active" : ""}${pin}" data-item="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
    });

    if(normalized && list.length === 0){
      chips.push(`<button type="button" class="chip add" data-add="1" data-label="${escapeHtml(normalized)}">+ Add ${escapeHtml(normalized)}</button>`);
    }

    container.innerHTML = chips.join("");
  }

  function setSegmentedActive(root, value){
    if(!root) return;
    const btns = [...root.querySelectorAll(".seg-btn")];
    btns.forEach(b => b.classList.toggle("active", b.dataset.value === value));
  }

  function refreshSegmentStatus(dateKey, segId){
    const day = getDay(dateKey);
    const seg = day.segments[segId];
    if(!seg || !els.segStatus) return;
    setSegmentedActive(els.segStatus, seg.status || "unlogged");
  }

  function updateSheetHints(dateKey, segId){
    if(!els.flagHelp) return;
    const day = getDay(dateKey);
    const seg = day.segments[segId];
    if(!seg) return;

    const state = getState();
    const effective = effectiveSegmentFlags(seg, state.rosters);

    if(effective.seedOilHint && seg.seedOil !== "yes" && seg.seedOil !== "none"){
      els.flagHelp.textContent = "⚠️ Potential seed oils detected in fats. Check tags.";
      els.flagHelp.classList.add("warn-text");
    }else{
      els.flagHelp.textContent = "Collision auto = fat:dense + carb:starch. High‑fat auto = fat:dense.";
      els.flagHelp.classList.remove("warn-text");
    }
  }

  // --- Daily fields (rituals / signals / notes) ---
  function renderScales(dateKey){
    const day = getDay(dateKey);
    buildScale(els.energyScale, "energy", day.energy);
    buildScale(els.moodScale, "mood", day.mood);
    buildScale(els.cravingsScale, "cravings", day.cravings);
  }

  function buildScale(container, field, value){
    const cur = value || "";
    container.innerHTML = "";
    for(let i = 1; i <= 5; i++){
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dot" + (cur === String(i) ? " active" : "");
      dot.setAttribute("aria-label", `${field} ${i}`);
      dot.addEventListener("click", () => {
        const dateKey = yyyyMmDd(getCurrentDate());
        captureUndo("Signal updated", () => {
          const day = getDay(dateKey);
          const next = (day[field] === String(i)) ? "" : String(i);
          day[field] = next;
          setDay(dateKey, day);
        });
        renderScales(dateKey);
      });
      container.appendChild(dot);
    }
  }

  function renderRituals(dateKey){
    const day = getDay(dateKey);
    const setPressed = (btn, on) => btn.setAttribute("aria-pressed", on ? "true" : "false");

    setPressed(els.movedBeforeLunch, day.movedBeforeLunch);
    setPressed(els.trained, day.trained);
    setPressed(els.highFatDay, day.highFatDay);

    els.moveSub.textContent = day.movedBeforeLunch ? "Done" : "Not yet";
    els.trainSub.textContent = day.trained ? "Done" : "Not yet";
    els.fatDaySub.textContent = day.highFatDay ? "Marked" : "Not yet";
  }

  function wireNotes(dateKey){
    els.notes.value = getDay(dateKey).notes || "";
  }

  function renderToday(){
    const dateKey = yyyyMmDd(getCurrentDate());
    els.datePicker.value = dateKey;

    const day = getDay(dateKey);
    if(!getState().logs[dateKey]){
      setDay(dateKey, day);
    }

    renderTimeline(dateKey, day);
    renderRituals(dateKey);
    renderScales(dateKey);
    wireNotes(dateKey);
  }

  function mergeDayDiversity(day){
    const out = { proteins: 0, carbs: 0, fats: 0, micros: 0 };
    const sets = { proteins: new Set(), carbs: new Set(), fats: new Set(), micros: new Set() };
    for(const seg of Object.values(day.segments || {})){
      for(const k of ["proteins", "carbs", "fats", "micros"]){
        (seg[k] || []).forEach(x => sets[k].add(x));
      }
    }
    out.proteins = sets.proteins.size;
    out.carbs = sets.carbs.size;
    out.fats = sets.fats.size;
    out.micros = sets.micros.size;
    return out;
  }

  function countIssues(day){
    const state = getState();
    let collision = false;
    let seedOil = false;
    let highFat = false;
    for(const seg of Object.values(day.segments || {})){
      const effective = effectiveSegmentFlags(seg, state.rosters);
      if(effective.collision.value) collision = true;
      if(seg.seedOil === "yes") seedOil = true;
      if(effective.highFatMeal.value) highFat = true;
    }
    return { collision, seedOil, highFat };
  }

  function renderHistory(){
    const state = getState();
    const keys = Object.keys(state.logs).sort().reverse();
    const list = keys.slice(0, 30);

    els.historyList.innerHTML = list.map(k => {
      const d = state.logs[k];
      const all = mergeDayDiversity(d);
      const issues = countIssues(d);
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

    els.historyList.querySelectorAll(".day-item").forEach(el => {
      el.addEventListener("click", () => {
        const k = el.dataset.date;
        setCurrentDate(new Date(k + "T12:00:00"));
        setActiveTab("today");
        renderToday();
      });
    });
  }

  function renderReview(){
    if(!els.coverageMatrix) return;
    const state = getState();
    const rawWeekStart = state.settings.weekStart;
    const parsedWeekStart = Number.isFinite(rawWeekStart) ? rawWeekStart : Number.parseInt(rawWeekStart, 10);
    const weekStart = Number.isFinite(parsedWeekStart) && parsedWeekStart >= 0 && parsedWeekStart <= 6
      ? parsedWeekStart
      : 0;
    const anchor = getCurrentDate();
    const dateKeys = getWeekDateKeys(anchor, weekStart);
    const matrix = computeCoverageMatrix(state.logs, state.rosters, dateKeys);

    if(els.reviewRange){
      const start = dateKeys[0] || "—";
      const end = dateKeys[dateKeys.length - 1] || "—";
      els.reviewRange.textContent = `${start} → ${end}`;
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
      const cell = (value) => {
        const empty = value === 0 || value === "—";
        const content = (value === 0) ? "—" : value;
        const cls = empty ? "matrix-cell empty" : "matrix-cell";
        return `<div class="${cls}">${content}</div>`;
      };
      const flag = (on, glyph) => `<div class="matrix-cell flag ${on ? "on" : "empty"}">${on ? glyph : "—"}</div>`;
      return `
        <div class="matrix-row" data-date="${escapeHtml(row.dateKey)}">
          <div class="matrix-date">${escapeHtml(row.dateKey)}</div>
          ${cell(row.counts.proteins)}
          ${cell(row.counts.carbs)}
          ${cell(row.counts.fats)}
          ${cell(row.counts.micros)}
          ${flag(row.flags.collision, "×")}
          ${flag(row.flags.seedOil, "⚠")}
          ${flag(row.flags.highFat, "◎")}
        </div>
      `;
    }).join("");

    els.coverageMatrix.innerHTML = head + rows;
    els.coverageMatrix.querySelectorAll(".matrix-row[data-date]").forEach((row) => {
      row.addEventListener("click", () => {
        const key = row.dataset.date;
        if(!key) return;
        setCurrentDate(new Date(key + "T12:00:00"));
        setActiveTab("today");
        renderToday();
      });
    });

    if(els.rotationPicks){
      const picks = computeRotationPicks({ rosters: state.rosters, logs: state.logs }, { limitPerCategory: 2, dateKeys });
      const labelMap = {
        proteins: "Proteins",
        carbs: "Carbs",
        fats: "Fats",
        micros: "Accoutrements (μ)"
      };
      const rowsHtml = Object.keys(labelMap).map((cat) => {
        const items = picks[cat] || [];
        const chips = items.length
          ? items.map((item) => `<span class="chip">${escapeHtml(item.label)}</span>`).join("")
          : `<span class="tiny muted">No picks yet</span>`;
        return `
          <div class="pick-row">
            <div class="pick-label">${labelMap[cat]}</div>
            <div class="pick-items">${chips}</div>
          </div>
        `;
      }).join("");
      els.rotationPicks.innerHTML = rowsHtml;
    }
  }

  function setImportStatus(message, isError){
    if(!els.importStatus) return;
    els.importStatus.textContent = message || "";
    els.importStatus.classList.toggle("status-error", !!isError);
  }

  function setImportApplyEnabled(enabled){
    if(els.importApply){
      els.importApply.disabled = !enabled;
    }
  }

  function clearPendingImport(){
    pendingImport = null;
    pendingImportName = "";
    setImportApplyEnabled(false);
  }

  function getImportMode(){
    const active = els.importMode?.querySelector(".seg-btn.active");
    return active?.dataset.value || "merge";
  }

  function renderRosterList(category, container){
    const state = getState();
    const items = (Array.isArray(state.rosters[category]) ? state.rosters[category] : [])
      .map((entry) => {
        if(typeof entry === "string"){
          return { id: entry, label: entry, aliases: [], tags: [], pinned: false, archived: false };
        }
        return entry;
      });
    const sorted = items
      .slice()
      .sort((a, b) => {
        const aArch = a?.archived ? 1 : 0;
        const bArch = b?.archived ? 1 : 0;
        if(aArch !== bArch) return aArch - bArch;
        const pin = (b?.pinned ? 1 : 0) - (a?.pinned ? 1 : 0);
        if(pin !== 0) return pin;
        return String(a?.label || "").localeCompare(String(b?.label || ""));
      });

    container.innerHTML = sorted.map(item => {
      const id = item?.id || "";
      const label = item?.label || "";
      const aliases = Array.isArray(item?.aliases) ? item.aliases.join(", ") : "";
      const tags = Array.isArray(item?.tags) ? item.tags.join(", ") : "";
      const pinned = item?.pinned ? "active" : "";
      const archived = item?.archived ? "active" : "";
      const archivedClass = item?.archived ? " archived" : "";
      return `
        <div class="roster-item${archivedClass}" data-id="${escapeHtml(id)}">
          <div class="roster-row">
            <input class="roster-input" type="text" data-field="label" value="${escapeHtml(label)}" />
            <div class="roster-actions">
              <button class="btn ghost tinybtn ${pinned}" type="button" data-action="pin">${item?.pinned ? "Pinned" : "Pin"}</button>
              <button class="btn ghost tinybtn ${archived}" type="button" data-action="archive">${item?.archived ? "Archived" : "Archive"}</button>
              <button class="btn ghost tinybtn" type="button" data-action="remove">Remove</button>
            </div>
          </div>
          <div class="roster-row">
            <input class="roster-input" type="text" data-field="aliases" placeholder="Aliases (comma-separated)" value="${escapeHtml(aliases)}" />
          </div>
          <div class="roster-row">
            <input class="roster-input" type="text" data-field="tags" placeholder="Tags (comma-separated)" value="${escapeHtml(tags)}" />
          </div>
        </div>
      `;
    }).join("");
  }

  function parseCommaList(value){
    return String(value || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function wireRosterContainer(category, container){
    if(!container) return;
    const timers = new Map();

    const schedule = (key, fn) => {
      if(timers.has(key)) clearTimeout(timers.get(key));
      const t = setTimeout(() => {
        timers.delete(key);
        fn();
      }, 320);
      timers.set(key, t);
    };

    container.addEventListener("input", (e) => {
      const input = e.target.closest(".roster-input");
      if(!input) return;
      const field = input.dataset.field;
      const itemEl = input.closest(".roster-item");
      if(!field || !itemEl) return;
      const itemId = itemEl.dataset.id;
      if(!itemId) return;

      if(field === "label"){
        const next = input.value.trim();
        if(!next) return;
        schedule(`${itemId}:${field}`, () => {
          captureUndo("Roster label updated", () => actions.updateRosterLabel(category, itemId, next));
        });
        return;
      }

      if(field === "aliases"){
        const list = parseCommaList(input.value);
        schedule(`${itemId}:${field}`, () => {
          captureUndo("Roster aliases updated", () => actions.updateRosterAliases(category, itemId, list));
        });
        return;
      }

      if(field === "tags"){
        const list = parseCommaList(input.value);
        schedule(`${itemId}:${field}`, () => {
          captureUndo("Roster tags updated", () => actions.updateRosterTags(category, itemId, list));
        });
      }
    });

    container.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if(!btn) return;
      const itemEl = btn.closest(".roster-item");
      if(!itemEl) return;
      const itemId = itemEl.dataset.id;
      if(!itemId) return;
      const action = btn.dataset.action;

      if(action === "pin"){
        captureUndo("Roster pin toggled", () => actions.toggleRosterPinned(category, itemId));
        renderSettings();
        renderToday();
        return;
      }

      if(action === "archive"){
        captureUndo("Roster archive toggled", () => actions.toggleRosterArchived(category, itemId));
        renderSettings();
        renderToday();
        return;
      }

      if(action === "remove"){
        if(confirm("Remove this item? This removes it from all logs.")){
          captureUndo("Roster item removed", () => actions.removeRosterItem(category, itemId));
          renderSettings();
          renderToday();
        }
      }
    });
  }

  function renderSettings(){
    const state = getState();
    const s = state.settings;
    els.setDayStart.value = s.dayStart;
    els.setDayEnd.value = s.dayEnd;
    els.setFtnEnd.value = s.ftnEnd;
    els.setLunchEnd.value = s.lunchEnd;
    els.setDinnerEnd.value = s.dinnerEnd;
    els.setSunrise.value = s.sunrise;
    els.setSunset.value = s.sunset;
    els.setSunMode.value = s.sunMode || "manual";
    els.setPhase.value = s.phase || "";
    els.setFocusMode.value = s.focusMode || "nowfade";

    const autoSun = (s.sunMode === "auto");
    els.setSunrise.disabled = autoSun;
    els.setSunset.disabled = autoSun;

    renderRosterList("proteins", els.rosterProteins);
    renderRosterList("carbs", els.rosterCarbs);
    renderRosterList("fats", els.rosterFats);
    renderRosterList("micros", els.rosterMicros);
  }

  function renderAll(){
    renderToday();
    renderHistory();
    renderReview();
    renderSettings();
  }

  function wire(){
    // tabs
    els.tabToday.addEventListener("click", () => { setActiveTab("today"); renderToday(); });
    els.tabHistory.addEventListener("click", () => { setActiveTab("history"); renderHistory(); });
    els.tabReview.addEventListener("click", () => { setActiveTab("review"); renderReview(); });
    els.tabSettings.addEventListener("click", () => { setActiveTab("settings"); renderSettings(); });

    // date nav
    els.prevDay.addEventListener("click", () => { setCurrentDate(addDays(getCurrentDate(), -1)); renderToday(); });
    els.nextDay.addEventListener("click", () => { setCurrentDate(addDays(getCurrentDate(), 1)); renderToday(); });
    els.datePicker.addEventListener("change", () => {
      if(els.datePicker.value){
        setCurrentDate(new Date(els.datePicker.value + "T12:00:00"));
        renderToday();
      }
    });

    // focus toggle
    els.toggleFocus.addEventListener("click", () => {
      actions.toggleFocusMode();
      renderToday();
    });

    // rituals
    els.movedBeforeLunch.addEventListener("click", () => {
      const dateKey = yyyyMmDd(getCurrentDate());
      captureUndo("Move pre-lunch", () => actions.toggleBoolField(dateKey, "movedBeforeLunch"));
      renderRituals(dateKey);
    });
    els.trained.addEventListener("click", () => {
      const dateKey = yyyyMmDd(getCurrentDate());
      captureUndo("Training", () => actions.toggleBoolField(dateKey, "trained"));
      renderRituals(dateKey);
    });
    els.highFatDay.addEventListener("click", () => {
      const dateKey = yyyyMmDd(getCurrentDate());
      captureUndo("High-fat day", () => actions.toggleBoolField(dateKey, "highFatDay"));
      renderRituals(dateKey);
    });

    // daily notes
    els.notes.addEventListener("input", () => {
      const dateKey = yyyyMmDd(getCurrentDate());
      clearTimeout(notesDebounce);
      notesDebounce = setTimeout(() => {
        captureUndo("Notes updated", () => actions.setDayField(dateKey, "notes", els.notes.value || ""));
      }, 320);
    });

    // history export/import
    els.exportBtn.addEventListener("click", actions.exportState);
    if(els.importMode){
      setSegmentedActive(els.importMode, "merge");
      els.importMode.addEventListener("click", (e) => {
        const btn = e.target.closest(".seg-btn");
        if(!btn) return;
        setSegmentedActive(els.importMode, btn.dataset.value);
      });
    }

    els.importFile.addEventListener("change", async () => {
      const f = els.importFile.files && els.importFile.files[0];
      if(!f){
        els.importFile.value = "";
        clearPendingImport();
        return;
      }

      let text = "";
      try{
        text = await f.text();
      }catch(err){
        console.error(err);
        setImportStatus("Import failed: could not read file.", true);
        clearPendingImport();
        els.importFile.value = "";
        return;
      }

      let payload = null;
      try{
        payload = JSON.parse(text);
      }catch(err){
        console.error(err);
        setImportStatus("Import failed: invalid JSON.", true);
        clearPendingImport();
        els.importFile.value = "";
        return;
      }

      const validation = actions.validateImportPayload(payload);
      if(!validation.ok){
        setImportStatus(validation.error || "Import failed: unsupported payload.", true);
        clearPendingImport();
        els.importFile.value = "";
        return;
      }

      pendingImport = payload;
      pendingImportName = f.name || "import";
      setImportApplyEnabled(true);
      const legacyNote = validation.legacy ? "Legacy payload detected; will migrate." : "Payload validated.";
      setImportStatus(`${legacyNote} Ready to import ${pendingImportName}. Choose Merge or Replace, then Apply.`, false);
      els.importFile.value = "";
    });

    if(els.importApply){
      els.importApply.addEventListener("click", async () => {
        if(!pendingImport){
          setImportStatus("Choose an import file first.", true);
          return;
        }
        const mode = getImportMode();
        if(mode === "replace"){
          const ok = confirm("Replace will overwrite your current logs and rosters. Continue?");
          if(!ok) return;
        }

        const result = await actions.applyImportPayload(pendingImport, mode);
        if(!result.ok){
          setImportStatus(result.error || "Import failed.", true);
          return;
        }

        clearPendingImport();
        renderAll();
        setImportStatus(`Import ${mode} complete.`, false);
      });
    }

    // settings save/reset
    els.saveSettings.addEventListener("click", () => {
      const s = {
        dayStart: els.setDayStart.value || defaults.DEFAULT_SETTINGS.dayStart,
        dayEnd: els.setDayEnd.value || defaults.DEFAULT_SETTINGS.dayEnd,
        ftnEnd: els.setFtnEnd.value || defaults.DEFAULT_SETTINGS.ftnEnd,
        lunchEnd: els.setLunchEnd.value || defaults.DEFAULT_SETTINGS.lunchEnd,
        dinnerEnd: els.setDinnerEnd.value || defaults.DEFAULT_SETTINGS.dinnerEnd,
        sunrise: els.setSunrise.value || defaults.DEFAULT_SETTINGS.sunrise,
        sunset: els.setSunset.value || defaults.DEFAULT_SETTINGS.sunset,
        sunMode: els.setSunMode.value || "manual",
        phase: els.setPhase.value || "",
        focusMode: els.setFocusMode.value || "nowfade"
      };

      captureUndo("Settings saved", () => actions.updateSettings(s));
      renderAll();
      alert("Saved.");
    });

    els.setSunMode.addEventListener("change", () => {
      const autoSun = els.setSunMode.value === "auto";
      els.setSunrise.disabled = autoSun;
      els.setSunset.disabled = autoSun;
    });

    els.resetToday.addEventListener("click", () => {
      const k = getActiveDateKey();
      if(confirm("Reset today's logs?")){
        captureUndo("Day reset", () => actions.resetDay(k));
        setCurrentDate(dateFromKey(k));
        renderAll();
      }
    });

    // roster add buttons (Settings)
    document.querySelectorAll('[data-roster]').forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.roster;
        const name = prompt(`Add to ${cat}:`);
        if(!name) return;
        captureUndo("Roster item added", () => actions.addRosterItem(cat, name));
        renderSettings();
        renderToday();
      });
    });

    wireRosterContainer("proteins", els.rosterProteins);
    wireRosterContainer("carbs", els.rosterCarbs);
    wireRosterContainer("fats", els.rosterFats);
    wireRosterContainer("micros", els.rosterMicros);

    // sheet close
    els.sheetBackdrop.addEventListener("click", closeSegment);
    els.closeSheet.addEventListener("click", closeSegment);
    els.doneSegment.addEventListener("click", closeSegment);

    // sheet clear
    els.clearSegment.addEventListener("click", () => {
      const currentSegmentId = getCurrentSegmentId();
      if(!currentSegmentId) return;
      const dateKey = yyyyMmDd(getCurrentDate());
      captureUndo("Segment cleared", () => actions.clearSegment(dateKey, currentSegmentId));
      openSegment(dateKey, currentSegmentId); // refresh UI
      updateSegmentVisual(dateKey, currentSegmentId);
    });

    // sheet chips (event delegation)
    const wireChipContainer = (container, category) => {
      container.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip");
        if(!btn) return;
        const dateKey = yyyyMmDd(getCurrentDate());
        const currentSegmentId = getCurrentSegmentId();
        if(!currentSegmentId) return;

        if(btn.dataset.add === "1"){
          const label = btn.dataset.label;
          if(!label) return;
          captureUndo("Item added", () => {
            const entry = actions.addRosterItem(category, label);
            if(entry && entry.id){
              actions.toggleSegmentItem(dateKey, currentSegmentId, category, entry.id);
            }
          });
          rosterSearch[category] = "";
          const input = searchInputs[category];
          if(input) input.value = "";
          openSegment(dateKey, currentSegmentId);
          renderSettings();
          return;
        }

        const item = btn.dataset.item;
        if(!item) return;
        captureUndo("Segment updated", () => actions.toggleSegmentItem(dateKey, currentSegmentId, category, item));
        // quick UI update
        btn.classList.toggle("active");
        refreshSegmentStatus(dateKey, currentSegmentId);
        updateSegmentVisual(dateKey, currentSegmentId);
        updateSheetHints(dateKey, currentSegmentId);
      });
    };

    const searchInputs = {
      proteins: els.searchProteins,
      carbs: els.searchCarbs,
      fats: els.searchFats,
      micros: els.searchMicros
    };

    const chipContainers = {
      proteins: els.chipsProteins,
      carbs: els.chipsCarbs,
      fats: els.chipsFats,
      micros: els.chipsMicros
    };

    const renderCategoryChips = (category) => {
      const dateKey = yyyyMmDd(getCurrentDate());
      const currentSegmentId = getCurrentSegmentId();
      if(!currentSegmentId) return;
      const day = getDay(dateKey);
      const seg = day.segments[currentSegmentId];
      const roster = getState().rosters[category] || [];
      renderChipSet(chipContainers[category], roster, seg[category], rosterSearch[category]);
    };

    wireChipContainer(els.chipsProteins, "proteins");
    wireChipContainer(els.chipsCarbs, "carbs");
    wireChipContainer(els.chipsFats, "fats");
    wireChipContainer(els.chipsMicros, "micros");

    Object.entries(searchInputs).forEach(([category, input]) => {
      if(!input) return;
      input.addEventListener("input", () => {
        rosterSearch[category] = input.value || "";
        renderCategoryChips(category);
      });
    });

    // sheet add item
    const addFromSheet = (category) => {
      const name = prompt(`Add ${category} item:`);
      if(!name) return;

      captureUndo("Item added", () => actions.addRosterItem(category, name));

      // refresh sheet chips
      const dateKey = yyyyMmDd(getCurrentDate());
      if(getCurrentSegmentId()){
        openSegment(dateKey, getCurrentSegmentId());
      }
      renderSettings();
      renderToday();
    };

    els.addProtein.addEventListener("click", () => addFromSheet("proteins"));
    els.addCarb.addEventListener("click", () => addFromSheet("carbs"));
    els.addFat.addEventListener("click", () => addFromSheet("fats"));
    els.addMicro.addEventListener("click", () => addFromSheet("micros"));

    // sheet collision (tri-state)
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
    });

    // sheet high-fat meal (tri-state)
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
    });

    // sheet seed oil segmented
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
    });

    // sheet status segmented
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
    });

    // FTN mode segmented
    els.ftnModeSeg.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg-btn");
      if(!btn) return;
      const dateKey = yyyyMmDd(getCurrentDate());
      setSegmentedActive(els.ftnModeSeg, btn.dataset.value);
      captureUndo("FTN mode updated", () => actions.setSegmentField(dateKey, "ftn", "ftnMode", btn.dataset.value));
      refreshSegmentStatus(dateKey, "ftn");
      updateSegmentVisual(dateKey, "ftn");
    });

    // segment notes
    els.segNotes.addEventListener("input", () => {
      const currentSegmentId = getCurrentSegmentId();
      if(!currentSegmentId) return;
      const dateKey = yyyyMmDd(getCurrentDate());
      clearTimeout(segNotesTimer);
      segNotesTimer = setTimeout(() => {
        captureUndo("Segment notes updated", () => actions.setSegmentField(dateKey, currentSegmentId, "notes", els.segNotes.value || ""));
        refreshSegmentStatus(dateKey, currentSegmentId);
        updateSegmentVisual(dateKey, currentSegmentId);
      }, 320);
    });

    if(els.undoAction){
      els.undoAction.addEventListener("click", () => {
        if(!undoState) return;
        actions.replaceState(undoState);
        undoState = null;
        hideUndoToast();
        renderAll();
      });
    }
  }

  function startTicks(){
    // tick (sun position + now marker)
    setInterval(() => {
      const dateKey = yyyyMmDd(getCurrentDate());
      if(dateKey === getActiveDateKey()){
        renderSolarArc(dateKey);
        applyFutureFog(dateKey);
      }
    }, 20_000);
  }

  function init(){
    wire();
    setActiveTab("today");
    renderAll();
    startTicks();
  }

  return {
    renderAll,
    renderToday,
    renderHistory,
    renderSettings,
    renderTimeline,
    renderSolarArc,
    renderNowMarker,
    openSegment,
    closeSegment,
    init
  };
}
