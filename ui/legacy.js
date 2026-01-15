// @ts-check

import { effectiveSegmentFlags, normalizeTri } from "../domain/heuristics.js";
import { computeSegmentWindows } from "../domain/time.js";
import { createRenderScheduler } from "../app/render_scheduler.js";
import { renderHistoryScreen } from "./screens/history.js";
import { renderReviewScreen } from "./screens/review.js";
import { renderSettingsScreen } from "./screens/settings.js";
import { renderTodayScreen } from "./screens/today.js";
import { createSegmentEditor } from "./screens/segment_editor.js";
import { wireSegmentEditor } from "./screens/segment_editor_wiring.js";
import { renderChipSet } from "./components/chip_grid.js";
import { renderRosterList as renderRosterListComponent } from "./components/roster_list.js";
import { renderAuditLog as renderAuditLogComponent } from "./components/audit_log.js";
import { renderDiagnosticsPanel } from "./components/diagnostics.js";
import { renderScales as renderScalesComponent } from "./components/scales.js";
import { renderRituals as renderRitualsComponent } from "./components/rituals.js";
import { renderSupplements as renderSupplementsComponent } from "./components/supplements.js";
import { renderSyncStatus as renderSyncStatusComponent } from "./components/sync_status.js";
import {
  renderTimeline as renderTimelineComponent,
  renderSolarArc as renderSolarArcComponent,
  renderNowMarker as renderNowMarkerComponent,
  applyFutureFog as applyFutureFogComponent
} from "./components/timeline.js";
import {
  dayHasDailyContent,
  collectMissingRosterItems,
  formatLatLon,
  formatSnapshotTime,
  parseCommaList,
  parseCopySegments,
  segCounts,
  segmentHasContent
} from "./legacy_helpers.js";

export function createLegacyUI(ctx) {
  const { els, helpers, actions, defaults } = ctx;
  const {
    parseTimeToMinutes,
    minutesToTime,
    fmtTime,
    escapeHtml,
    clamp,
    nowMinutes,
    clampLocalTime,
    yyyyMmDd,
    addDays,
    dateFromKey,
    getActiveDateKey,
    computeSunTimes
  } = helpers;

  const getState = ctx.getState;
  const getDay = ctx.getDay;
  const setDay = ctx.setDay;
  const getCurrentDate = ctx.getCurrentDate;
  const setCurrentDate = ctx.setCurrentDate;
  const getCurrentSegmentId = ctx.getCurrentSegmentId;
  const setCurrentSegmentId = ctx.setCurrentSegmentId;

  let activeTab = "today";
  const dirtyViews = new Set();

  const segmentElsRef = { current: {} };
  let notesDebounce = null;
  let segNotesTimer = null;
  let supplementsNotesDebounce = null;
  const historyNotesTimers = new Map();
  let pendingImport = null;
  let pendingImportName = "";
  let reviewAnchorDate = new Date();
  const historyOpenDays = new Set();
  const historyFilters = {
    query: "",
    flags: {
      collision: false,
      seedOil: false,
      highFat: false,
      notes: false
    }
  };
  const diagState = {
    snapshotSeq: 0,
    auditSeq: 0,
    auditLogCache: [],
    historyPage: 1,
    pageSize: 10
  };
  let missingRosterItems = new Map();
  let rosterSearch = {
    proteins: "",
    carbs: "",
    fats: "",
    micros: ""
  };
  const searchInputs = {
    proteins: els.searchProteins,
    carbs: els.searchCarbs,
    fats: els.searchFats,
    micros: els.searchMicros
  };
  let undoState = null;
  let undoTimer = null;
  let reviewInsights = [];
  let todayNudgeInsight = null;
  const APP_LOCK_HASH_KEY = "shredmaxx_app_lock_hash";
  const APP_LOCK_SALT_KEY = "shredmaxx_app_lock_salt";
  const appLockEncoder = (typeof TextEncoder !== "undefined") ? new TextEncoder() : null;
  let appLocked = false;

  const segmentEditor = createSegmentEditor({
    els,
    getState,
    getDay,
    getSegmentDefs,
    setCurrentSegmentId,
    formatRange,
    escapeHtml,
    renderChipSet,
    getRosterSearch: () => rosterSearch,
    setRosterSearch: (next) => { rosterSearch = next; }
  });

  function liftMinuteToTimeline(minute, start) {
    return minute < start ? minute + 1440 : minute;
  }

  function cloneStateSnapshot() {
    const current = getState();
    if (typeof structuredClone === "function") {
      return structuredClone(current);
    }
    return JSON.parse(JSON.stringify(current));
  }

  function hideUndoToast() {
    if (!els.undoToast) return;
    els.undoToast.hidden = true;
  }

  function showUndoToast(label) {
    if (!els.undoToast || !els.undoLabel) return;
    els.undoLabel.textContent = label || "Change saved";
    els.undoToast.hidden = false;
    els.undoToast.classList.remove("hiding"); // Just in case
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      hideUndoToast();
    }, 5000);
  }

  function isSafeModeActive() {
    return !!getState().meta?.integrity?.safeMode;
  }

  function blockIfSafeMode(message) {
    if (!isSafeModeActive()) return false;
    showUndoToast(message || "Safe Mode: edits disabled");
    return true;
  }

  function captureUndo(label, fn) {
    if (blockIfSafeMode()) return;
    const snapshot = cloneStateSnapshot();
    const result = fn();
    undoState = snapshot;
    showUndoToast(label);
    return result;
  }

  function refreshPrivacyBlur() {
    applyPrivacyBlur();
  }

  // --- View switching ---
  function setActiveTab(which) {
    activeTab = which;
    dirtyViews.add(which);
    const map = {
      today: [els.tabToday, els.viewToday],
      history: [els.tabHistory, els.viewHistory],
      review: [els.tabReview, els.viewReview],
      settings: [els.tabSettings, els.viewSettings]
    };

    for (const [k, [tab, view]] of Object.entries(map)) {
      const on = (k === which);
      tab.classList.toggle("tab-active", on);
      view.classList.toggle("hidden", !on);
    }
  }

  function getSegmentDefs(settings) {
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

  function whichSegment(minute, defs) {
    for (const d of defs) {
      if (minute >= d.start && minute < d.end) return d.id;
    }
    return defs[defs.length - 1].id;
  }

  function formatRange(aMin, bMin) {
    return `${minutesToTime(aMin)}–${minutesToTime(bMin)}`;
  }

  function setSunAutoStatus(text) {
    if (!els.sunAutoStatus) return;
    els.sunAutoStatus.textContent = text || "";
  }

  function updateSunTimesFromLocation() {
    if (blockIfSafeMode()) return;
    if (!navigator || !navigator.geolocation) {
      setSunAutoStatus("Geolocation not available in this browser.");
      showUndoToast("Geolocation unavailable");
      if (getState().settings.sunMode === "auto") {
        captureUndo("Sun mode manual", () => actions.updateSettings({ sunMode: "manual" }));
        els.setSunMode.value = "manual";
        els.setSunrise.disabled = false;
        els.setSunset.disabled = false;
      }
      return;
    }

    setSunAutoStatus("Requesting location…");
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const result = computeSunTimes(new Date(), lat, lon);
      if (!result || result.status !== "ok" || result.sunrise == null || result.sunset == null) {
        const msg = result?.status === "polarDay"
          ? "Sun never sets here today."
          : result?.status === "polarNight"
            ? "Sun never rises here today."
            : "Could not compute sun times.";
        setSunAutoStatus(msg);
        showUndoToast("Sun times unavailable");
        return;
      }

      const sunrise = minutesToTime(result.sunrise);
      const sunset = minutesToTime(result.sunset);
      captureUndo("Sun times updated", () => actions.updateSettings({
        sunMode: "auto",
        sunrise,
        sunset,
        lastKnownLat: lat,
        lastKnownLon: lon
      }));

      els.setSunrise.value = sunrise;
      els.setSunset.value = sunset;
      els.setSunMode.value = "auto";
      els.setSunrise.disabled = true;
      els.setSunset.disabled = true;
      setSunAutoStatus(`Updated for ${formatLatLon(lat, lon)}`);
      showUndoToast("Sunrise/sunset updated");
    }, (err) => {
      const reason = err?.message ? `Location failed: ${err.message}` : "Location permission denied.";
      setSunAutoStatus(reason);
      showUndoToast("Location denied");
      if (getState().settings.sunMode === "auto") {
        captureUndo("Sun mode manual", () => actions.updateSettings({ sunMode: "manual" }));
        els.setSunMode.value = "manual";
        els.setSunrise.disabled = false;
        els.setSunset.disabled = false;
      }
    }, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 3600000
    });
  }

  function applyPrivacyBlur() {
    if (!els.privacyBlurOverlay) return;
    const enabled = !!getState()?.settings?.privacy?.blurOnBackground;
    const reduceEffects = !!getState()?.settings?.ui?.reduceEffects;
    const isHidden = (typeof document.visibilityState === "string")
      ? document.visibilityState !== "visible"
      : !!document.hidden;
    const shouldShow = enabled && isHidden && !reduceEffects;
    els.privacyBlurOverlay.classList.toggle("hidden", !shouldShow);
    els.privacyBlurOverlay.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  }

  function canUseCrypto() {
    return !!(appLockEncoder && globalThis.crypto && crypto.subtle && crypto.getRandomValues);
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  function base64ToBytes(str) {
    try {
      const binary = atob(str || "");
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
      }
      return out;
    } catch (e) {
      return new Uint8Array();
    }
  }

  function readAppLockRecord() {
    try {
      if (typeof localStorage === "undefined") return { hash: "", salt: "" };
      return {
        hash: localStorage.getItem(APP_LOCK_HASH_KEY) || "",
        salt: localStorage.getItem(APP_LOCK_SALT_KEY) || ""
      };
    } catch (e) {
      return { hash: "", salt: "" };
    }
  }

  function writeAppLockRecord(hash, salt) {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(APP_LOCK_HASH_KEY, hash);
      localStorage.setItem(APP_LOCK_SALT_KEY, salt);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearAppLockRecord() {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.removeItem(APP_LOCK_HASH_KEY);
      localStorage.removeItem(APP_LOCK_SALT_KEY);
    } catch (e) {
      // ignore
    }
  }

  async function hashPasscode(passcode, saltBytes) {
    if (!canUseCrypto()) return "";
    const passBytes = appLockEncoder.encode(String(passcode));
    const data = new Uint8Array(saltBytes.length + passBytes.length);
    data.set(saltBytes, 0);
    data.set(passBytes, saltBytes.length);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return bytesToBase64(new Uint8Array(digest));
  }

  function hasAppLockSecret() {
    const record = readAppLockRecord();
    return !!(record.hash && record.salt);
  }

  function isAppLockEnabled() {
    return !!getState()?.settings?.privacy?.appLock;
  }

  async function verifyAppLockPasscode(passcode) {
    if (!canUseCrypto()) return false;
    const record = readAppLockRecord();
    if (!record.hash || !record.salt) return false;
    const saltBytes = base64ToBytes(record.salt);
    if (!saltBytes.length) return false;
    const nextHash = await hashPasscode(passcode, saltBytes);
    return nextHash === record.hash;
  }

  async function setAppLockPasscode(passcode) {
    if (!canUseCrypto()) return false;
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const hash = await hashPasscode(passcode, saltBytes);
    if (!hash) return false;
    return writeAppLockRecord(hash, bytesToBase64(saltBytes));
  }

  function setAppLockMessage(msg) {
    if (!els.appLockMessage) return;
    els.appLockMessage.textContent = msg || "";
  }

  function showAppLockOverlay(msg) {
    if (!els.appLockOverlay) return;
    els.appLockOverlay.classList.remove("hidden");
    els.appLockOverlay.setAttribute("aria-hidden", "false");
    setAppLockMessage(msg || "");
    if (els.appLockInput) {
      els.appLockInput.value = "";
      setTimeout(() => els.appLockInput?.focus(), 50);
    }
  }

  function hideAppLockOverlay() {
    if (!els.appLockOverlay) return;
    els.appLockOverlay.classList.add("hidden");
    els.appLockOverlay.setAttribute("aria-hidden", "true");
    setAppLockMessage("");
  }

  function refreshAppLock() {
    if (!els.appLockOverlay) return;
    if (!canUseCrypto()) {
      appLocked = false;
      hideAppLockOverlay();
      return;
    }
    const enabled = isAppLockEnabled();
    const hasSecret = hasAppLockSecret();
    if (!enabled || !hasSecret) {
      appLocked = false;
      hideAppLockOverlay();
      return;
    }
    if (appLocked) {
      showAppLockOverlay("Enter your passcode to continue.");
    } else {
      hideAppLockOverlay();
    }
  }

  function applyAppLock() {
    refreshAppLock();
  }

  async function attemptUnlock() {
    if (!canUseCrypto()) {
      setAppLockMessage("App lock requires WebCrypto.");
      return;
    }
    if (!els.appLockInput) return;
    const passcode = els.appLockInput.value || "";
    if (!passcode) {
      setAppLockMessage("Enter passcode.");
      return;
    }
    const ok = await verifyAppLockPasscode(passcode);
    if (ok) {
      appLocked = false;
      refreshAppLock();
    } else {
      setAppLockMessage("Incorrect passcode.");
      els.appLockInput.value = "";
    }
  }

  function promptNewPasscode() {
    const passcode = prompt("Set a passcode (4+ characters):");
    if (!passcode) return null;
    if (passcode.length < 4) {
      alert("Passcode too short.");
      return null;
    }
    const confirmPass = prompt("Confirm passcode:");
    if (confirmPass !== passcode) {
      alert("Passcodes did not match.");
      return null;
    }
    return passcode;
  }

  async function ensureAppLockPasscode() {
    if (!canUseCrypto()) {
      alert("App lock requires WebCrypto.");
      return false;
    }
    const passcode = promptNewPasscode();
    if (!passcode) return false;
    const stored = await setAppLockPasscode(passcode);
    if (!stored) {
      alert("Failed to store passcode.");
      return false;
    }
    return true;
  }

  async function verifyExistingPasscode(actionLabel) {
    if (!canUseCrypto()) {
      alert("App lock requires WebCrypto.");
      return false;
    }
    const passcode = prompt(actionLabel || "Enter passcode:");
    if (!passcode) return false;
    const ok = await verifyAppLockPasscode(passcode);
    if (!ok) {
      alert("Incorrect passcode.");
    }
    return ok;
  }

  function getSegmentTimestamp(seg, day) {
    const ts = seg?.tsLast || seg?.tsFirst || day?.tsLast || day?.tsCreated;
    if (!ts) return null;
    const parsed = Date.parse(ts);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }

  function findLastLoggedSegment() {
    const state = getState();
    let best = null;
    let bestTs = -Infinity;
    for (const [dateKey, day] of Object.entries(state.logs || {})) {
      const segments = day?.segments || {};
      for (const [segId, seg] of Object.entries(segments)) {
        if (!segmentHasContent(seg, segId)) continue;
        const ts = getSegmentTimestamp(seg, day);
        if (ts === null) continue;
        if (ts > bestTs) {
          bestTs = ts;
          best = { dateKey, segId, seg };
        }
      }
    }
    return best;
  }

  function repeatLastSegment(dateKey, segId) {
    const last = findLastLoggedSegment();
    if (!last) {
      undoState = null;
      showUndoToast("No recent segment to copy");
      return;
    }
    captureUndo("Segment repeated", () => actions.copySegment(dateKey, segId, last.seg));
    updateSegmentVisual(dateKey, segId);
    if (getCurrentSegmentId() === segId && !els.sheet.classList.contains("hidden")) {
      openSegment(dateKey, segId);
    }
  }

  function copyYesterdayIntoToday() {
    if (typeof actions.copySegment !== "function") return;
    const targetKey = yyyyMmDd(getCurrentDate());
    const yesterdayKey = yyyyMmDd(addDays(getCurrentDate(), -1));
    const state = getState();
    if (!state.logs || !state.logs[yesterdayKey]) {
      undoState = null;
      showUndoToast("No log for yesterday");
      return;
    }

    openCopySelectionSheet(targetKey, yesterdayKey);
  }

  function openCopySelectionSheet(targetKey, sourceKey) {
    if (!els.sheet || !els.sheetBody) return;

    // Clear and prepare sheet
    els.sheetTitle.textContent = "Copy Data";
    els.sheetSub.textContent = `Source: ${sourceKey} → Target: ${targetKey}`;
    if (els.sheetWindowLabel) els.sheetWindowLabel.textContent = "BATCH";
    if (els.sheetWindowTime) els.sheetWindowTime.textContent = "—";
    if (els.ftnModeRow) els.ftnModeRow.classList.add("hidden");

    const sourceDay = getDay(sourceKey);
    const targetDay = getDay(targetKey);

    const segIds = ["ftn", "lunch", "dinner", "late"];
    let html = `
      <div class="copy-selection-panel">
        <p class="tiny muted mb">Select components to copy from yesterday. Existing data in target segments will be overwritten.</p>
        <div class="copy-list">
    `;

    segIds.forEach(id => {
      const hasSource = segmentHasContent(sourceDay.segments[id], id);
      const hasTarget = segmentHasContent(targetDay.segments[id], id);
      const disabled = !hasSource;
      html += `
        <label class="copy-item ${disabled ? "disabled" : ""}">
          <input type="checkbox" data-copy-seg="${id}" ${hasSource ? "checked" : ""} ${disabled ? "disabled" : ""}>
          <div class="copy-item-info">
            <div class="copy-item-title">${id.toUpperCase()}</div>
            <div class="copy-item-status">${hasSource ? "Available" : "Empty"} ${hasTarget ? " — <span class='warn-text'>(Overwrites)</span>" : ""}</div>
          </div>
        </label>
      `;
    });

    html += `
        <label class="copy-item">
          <input type="checkbox" data-copy-daily="true" checked>
          <div class="copy-item-info">
            <div class="copy-item-title">DAILY LOGS</div>
            <div class="copy-item-status">Notes, Toggles, Signals</div>
          </div>
        </label>
      </div>
      <div class="row gap mt">
        <button class="btn" id="confirmCopyBtn" type="button">Copy Selected</button>
        <button class="btn ghost" id="cancelCopyBtn" type="button">Cancel</button>
      </div>
    </div>
    `;

    els.sheetBody.innerHTML = html;
    els.sheet.classList.remove("hidden");
    els.sheet.setAttribute("aria-hidden", "false");

    const confirmBtn = els.sheetBody.querySelector("#confirmCopyBtn");
    const cancelBtn = els.sheetBody.querySelector("#cancelCopyBtn");

    cancelBtn.onclick = () => closeSegment();
    confirmBtn.onclick = () => {
      const selectedSegs = Array.from(els.sheetBody.querySelectorAll("[data-copy-seg]:checked")).map(el => el.dataset.copySeg);
      const includeDaily = !!els.sheetBody.querySelector("[data-copy-daily]:checked");

      if (selectedSegs.length === 0 && !includeDaily) {
        closeSegment();
        return;
      }

      captureUndo("Yesterday copied", () => {
        for (const segId of selectedSegs) {
          const sourceSeg = sourceDay.segments?.[segId];
          if (sourceSeg) {
            actions.copySegment(targetKey, segId, sourceSeg);
          }
        }
        if (includeDaily) {
          actions.setDayField(targetKey, "movedBeforeLunch", !!sourceDay.movedBeforeLunch);
          actions.setDayField(targetKey, "trained", !!sourceDay.trained);
          actions.setDayField(targetKey, "highFatDay", normalizeTri(sourceDay.highFatDay));
          actions.setDayField(targetKey, "energy", sourceDay.energy || "");
          actions.setDayField(targetKey, "mood", sourceDay.mood || "");
          actions.setDayField(targetKey, "cravings", sourceDay.cravings || "");
          actions.setDayField(targetKey, "notes", sourceDay.notes || "");
        }
      });

      closeSegment();
      renderAll();
    };
  }

  function renderTimeline(dateKey, day) {
    const state = getState();
    const defs = getSegmentDefs(state.settings);
    renderTimelineComponent({
      els,
      dateKey,
      state,
      segmentDefs: defs,
      formatRange,
      updateSegmentVisual,
      openSegment,
      repeatLastSegment,
      nowMinutes,
      getActiveDateKey,
      liftMinuteToTimeline,
      whichSegment,
      parseTimeToMinutes,
      clampLocalTime,
      dateFromKey,
      minutesToTime,
      fmtTime,
      clamp,
      segmentElsRef
    });
  }

  function applyFutureFog(dateKey) {
    const state = getState();
    const defs = getSegmentDefs(state.settings);
    const start = defs[0].start;
    const end = defs[defs.length - 1].end;
    applyFutureFogComponent({
      els,
      dateKey,
      state,
      start,
      end,
      nowMinutes,
      liftMinuteToTimeline,
      getActiveDateKey
    });
  }

  function renderSolarArc(dateKey) {
    const state = getState();
    const defs = getSegmentDefs(state.settings);
    const start = defs[0].start;
    const end = defs[defs.length - 1].end;
    renderSolarArcComponent({
      els,
      dateKey,
      state,
      segmentDefs: defs,
      start,
      end,
      nowMinutes,
      liftMinuteToTimeline,
      clamp,
      parseTimeToMinutes,
      clampLocalTime,
      dateFromKey,
      minutesToTime,
      fmtTime,
      getActiveDateKey,
      whichSegment,
      segmentElsRef
    });
    renderCurrentTime(dateKey);
  }

  function renderCurrentTime(dateKey) {
    if (!els.currentTime) return;
    if (dateKey !== getActiveDateKey()) {
      els.currentTime.textContent = "—";
      if (els.currentTz) els.currentTz.textContent = "—";
      return;
    }
    const now = new Date();
    const mins = String(now.getMinutes()).padStart(2, "0");
    const rawHours = now.getHours();
    const period = rawHours >= 12 ? "PM" : "AM";
    const hours = rawHours % 12 || 12;
    els.currentTime.innerHTML = `${hours}:${mins} <span class="time-period">${period}</span>`;
    if (els.currentTz) {
      let tzLabel = "";
      if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
        const parts = new Intl.DateTimeFormat([], { timeZoneName: "short" }).formatToParts(now);
        tzLabel = parts.find((part) => part.type === "timeZoneName")?.value || "";
      }
      els.currentTz.textContent = tzLabel || "Local";
    }
  }

  function renderNowMarker(dateKey) {
    const defs = getSegmentDefs(getState().settings);
    const start = defs[0].start;
    const end = defs[defs.length - 1].end;
    renderNowMarkerComponent({
      els,
      dateKey,
      segmentDefs: defs,
      start,
      end,
      nowMinutes,
      liftMinuteToTimeline,
      getActiveDateKey,
      whichSegment,
      segmentElsRef
    });
  }

  function updateSegmentVisual(dateKey, segId) {
    const day = getDay(dateKey);
    const seg = day.segments[segId];
    const el = segmentElsRef.current[segId];
    if (!el || !seg) return;

    const status = seg.status || "unlogged";
    el.classList.toggle("status-logged", status === "logged");
    el.classList.toggle("status-none", status === "none");
    el.classList.toggle("status-unlogged", status === "unlogged");

    // counts + bubble styles
    const counts = segCounts(seg);
    for (const k of ["P", "C", "F", "M"]) {
      const b = el.querySelector(`.bubble[data-b="${k}"]`);
      const c = el.querySelector(`.count[data-c="${k}"]`);
      const n = counts[k];
      if (!b || !c) continue;

      if (n > 0) {
        b.classList.remove("empty");
        c.textContent = String(n);
        c.style.display = "grid";
      } else {
        b.classList.add("empty");
        c.textContent = "";
        c.style.display = "none";
      }
    }

    // flags
    const flags = el.querySelector(".seg-flags");
    if (flags) {
      const state = getState();
      const effective = effectiveSegmentFlags(seg, state.rosters);
      flags.innerHTML = "";
      if (effective.collision.value) {
        const f = document.createElement("div");
        f.className = "flag bad";
        f.title = "HFHC collision";
        f.textContent = "×";
        flags.appendChild(f);
      }
      if (seg.seedOil === "yes") {
        const f = document.createElement("div");
        f.className = "flag warn";
        f.title = "Seed oils / unknown oils";
        f.textContent = "⚠";
        flags.appendChild(f);
      }
      if (effective.highFatMeal.value) {
        const f = document.createElement("div");
        f.className = "flag good";
        f.title = "High-fat meal";
        f.textContent = "◎";
        flags.appendChild(f);
      }
    }

    // FTN label tweak
    if (segId === "ftn") {
      const titleEl = el.querySelector(".segment-title");
      if (titleEl) {
        const mode = seg.ftnMode || "";
        titleEl.textContent = mode ? `FTN (${mode.toUpperCase()})` : "FTN";
      }
    }
  }

  // --- Sheet (segment editor) ---
  function openSegment(dateKey, segId) {
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
    segmentEditor.openSegment(dateKey, segId);
    if (t0) {
      const dt = (typeof performance !== "undefined" && performance.now) ? performance.now() - t0 : 0;
      logPerf("sheet_open", dt, { dateKey, segId });
    }
  }

  function closeSegment() {
    segmentEditor.closeSegment();
  }

  function setSegmentedActive(root, value) {
    segmentEditor.setSegmentedActive(root, value);
  }

  function refreshSegmentStatus(dateKey, segId) {
    segmentEditor.refreshSegmentStatus(dateKey, segId);
  }

  function updateSheetHints(dateKey, segId) {
    segmentEditor.updateSheetHints(dateKey, segId);
  }

  // --- Daily fields (rituals / signals / notes) ---
  function renderScales(dateKey) {
    renderScalesComponent({
      els,
      dateKey,
      getDay,
      setDay,
      getCurrentDate,
      yyyyMmDd,
      captureUndo,
      rerender: renderScales
    });
  }

  function renderRituals(dateKey) {
    const day = getDay(dateKey);
    renderRitualsComponent({ els, day });
  }

  function wireNotes(dateKey) {
    els.notes.value = getDay(dateKey).notes || "";
  }

  function renderSupplements(dateKey) {
    const state = getState();
    const day = getDay(dateKey);
    renderSupplementsComponent({
      els,
      state,
      dateKey,
      day,
      escapeHtml,
      onToggle: (itemId, key) => {
        if (typeof actions.toggleSupplementItem !== "function") return;
        captureUndo("Supplement toggled", () => actions.toggleSupplementItem(key, itemId));
        renderSupplements(key);
      }
    });
  }

  function applyHomeRedaction() {
    const redacted = !!getState().settings?.privacy?.redactHome;
    if (els.notesBlock) els.notesBlock.hidden = redacted;
    if (els.redactionBanner) els.redactionBanner.hidden = !redacted;
    document.body.classList.toggle("redact-home", redacted);
  }

  function applyUiPreferences() {
    const reduce = !!getState().settings?.ui?.reduceEffects;
    document.body.classList.toggle("reduce-effects", reduce);
    if (reduce) {
      document.body.dataset.reduceEffects = "true";
    } else {
      delete document.body.dataset.reduceEffects;
    }
  }

  const PERF_LOG_KEY = "shredmaxx_perf_log";
  function isPerfLogging() {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(PERF_LOG_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function setPerfLogging(enabled) {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(PERF_LOG_KEY, enabled ? "1" : "0");
    } catch (e) {
      // ignore storage failures
    }
  }
  function logPerf(label, duration, detail) {
    if (!isPerfLogging()) return;
    if (typeof actions.logAuditEvent !== "function") return;
    const ms = Number.isFinite(duration) ? duration : 0;
    actions.logAuditEvent("perf", `${label} ${ms.toFixed(1)}ms`, "info", { label, duration: ms, ...(detail || {}) });
  }

  function renderToday() {
    const dateKey = yyyyMmDd(getCurrentDate());
    els.datePicker.value = dateKey;

    const state = getState();
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
    const result = renderTodayScreen({
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
    });
    todayNudgeInsight = result?.todayNudgeInsight || null;
    if (t0) {
      const dt = (typeof performance !== "undefined" && performance.now) ? performance.now() - t0 : 0;
      logPerf("render_today", dt, { dateKey });
    }
  }

  function renderDiagnostics() {
    const state = getState();
    const result = renderDiagnosticsPanel({
      els,
      state,
      actions,
      parseTimeToMinutes,
      clampLocalTime,
      formatSnapshotTime,
      escapeHtml,
      diagState,
      onRestoreSnapshot: async (snapshotId) => {
        try {
          undoState = null;
          await actions.restoreSnapshot(snapshotId);
          renderAll();
          showUndoToast("Snapshot restored");
        } catch (e) {
          showUndoToast("Snapshot restore failed");
        }
      },
      onDeleteSnapshot: async (snapshotId) => {
        try {
          await actions.deleteSnapshot(snapshotId);
          renderDiagnostics();
          showUndoToast("Snapshot deleted");
        } catch (e) {
          showUndoToast("Snapshot delete failed");
        }
      }
    });
    missingRosterItems = result?.missingRosterItems || new Map();
    if (els.perfLogToggle) {
      els.perfLogToggle.checked = isPerfLogging();
    }
  }

  function renderSyncStatus() {
    const state = getState();
    const sync = state?.meta?.sync || {};
    const mode = state?.settings?.sync?.mode || "hosted";
    renderSyncStatusComponent({ els, sync, mode });
  }

  function renderHistory() {
    const state = getState();
    renderHistoryScreen({
      els,
      state,
      escapeHtml,
      formatSnapshotTime,
      openDays: historyOpenDays,
      filters: historyFilters,
      page: diagState.historyPage,
      pageSize: diagState.pageSize
    });

    renderDiagnostics();
  }

  function renderReview() {
    const state = getState();
    const anchorDate = reviewAnchorDate || getCurrentDate();
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
    const result = renderReviewScreen({
      els,
      state,
      anchorDate,
      escapeHtml,
      onPerf: (label, duration, detail) => {
        logPerf(`review_${label}`, duration, detail);
      },
      onMatrixSelect: (key, col) => {
        setCurrentDate(new Date(key + "T12:00:00"));
        setActiveTab("today");
        markViewDirty("today");
        queueRender("main");
        if (col) {
          const segId = findSegmentForMatrixCell(getDay(key), col);
          if (segId) {
            openSegment(key, segId);
          }
        }
      }
    });
    reviewInsights = Array.isArray(result?.insights) ? result.insights : [];
    if (t0) {
      const dt = (typeof performance !== "undefined" && performance.now) ? performance.now() - t0 : 0;
      logPerf("render_review", dt, { anchor: anchorDate instanceof Date ? anchorDate.toISOString() : "" });
    }
  }

  function findSegmentForMatrixCell(day, col) {
    const order = ["ftn", "lunch", "dinner", "late"];
    const segments = day?.segments || {};
    const state = getState();

    if (["proteins", "carbs", "fats", "micros"].includes(col)) {
      for (const id of order) {
        const seg = segments[id];
        if (seg && Array.isArray(seg[col]) && seg[col].length) {
          return id;
        }
      }
      return null;
    }

    if (col === "seedOil") {
      for (const id of order) {
        const seg = segments[id];
        if (seg?.seedOil === "yes") return id;
      }
      return null;
    }

    if (col === "collision" || col === "highFat") {
      for (const id of order) {
        const seg = segments[id];
        if (!seg) continue;
        const effective = effectiveSegmentFlags(seg, state.rosters);
        if (col === "collision" && effective.collision.value) return id;
        if (col === "highFat" && effective.highFatMeal.value) return id;
      }
      return null;
    }

    return null;
  }

  function setImportStatus(message, isError) {
    if (!els.importStatus) return;
    els.importStatus.textContent = message || "";
    els.importStatus.classList.toggle("status-error", !!isError);
  }

  function setImportApplyEnabled(enabled) {
    if (els.importApply) {
      els.importApply.disabled = !enabled;
    }
  }

  function clearPendingImport() {
    pendingImport = null;
    pendingImportName = "";
    setImportApplyEnabled(false);
  }

  function getImportMode() {
    const active = els.importMode?.querySelector(".seg-btn.active");
    return active?.dataset.value || "merge";
  }

  function renderRosterList(category, container) {
    const state = getState();
    renderRosterListComponent(category, container, state.rosters[category], escapeHtml);
  }

  function wireRosterContainer(category, container) {
    if (!container) return;
    const timers = new Map();

    const schedule = (key, fn) => {
      if (timers.has(key)) clearTimeout(timers.get(key));
      const t = setTimeout(() => {
        timers.delete(key);
        fn();
      }, 320);
      timers.set(key, t);
    };

    container.addEventListener("input", (e) => {
      const input = e.target.closest(".roster-input");
      if (!input) return;
      const field = input.dataset.field;
      const itemEl = input.closest(".roster-item");
      if (!field || !itemEl) return;
      const itemId = itemEl.dataset.id;
      if (!itemId) return;

      if (field === "label") {
        const next = input.value.trim();
        if (!next) return;
        schedule(`${itemId}:${field}`, () => {
          captureUndo("Roster label updated", () => actions.updateRosterLabel(category, itemId, next));
        });
        return;
      }

      if (field === "aliases") {
        const list = parseCommaList(input.value);
        schedule(`${itemId}:${field}`, () => {
          captureUndo("Roster aliases updated", () => actions.updateRosterAliases(category, itemId, list));
        });
        return;
      }

      if (field === "icon") {
        const next = input.value || "";
        schedule(`${itemId}:${field}`, () => {
          captureUndo("Roster icon updated", () => actions.updateRosterIcon(category, itemId, next));
        });
        return;
      }

      if (field === "tags") {
        const list = parseCommaList(input.value);
        schedule(`${itemId}:${field}`, () => {
          captureUndo("Roster tags updated", () => actions.updateRosterTags(category, itemId, list));
        });
      }
    });

    container.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const itemEl = btn.closest(".roster-item");
      if (!itemEl) return;
      const itemId = itemEl.dataset.id;
      if (!itemId) return;
      const action = btn.dataset.action;

      if (action === "pin") {
        captureUndo("Roster pin toggled", () => actions.toggleRosterPinned(category, itemId));
        markViewDirty("settings");
        markViewDirty("today");
        queueRender("main");
        return;
      }

      if (action === "archive") {
        captureUndo("Roster archive toggled", () => actions.toggleRosterArchived(category, itemId));
        markViewDirty("settings");
        markViewDirty("today");
        queueRender("main");
        return;
      }

      if (action === "remove") {
        if (confirm("Remove this item? This removes it from all logs.")) {
          captureUndo("Roster item removed", () => actions.removeRosterItem(category, itemId));
          markViewDirty("settings");
          markViewDirty("today");
          queueRender("main");
        }
      }
    });
  }

  function renderSettings() {
    const state = getState();
    renderSettingsScreen({
      els,
      state,
      setSunAutoStatus,
      formatLatLon,
      refreshPrivacyBlur,
      renderRosterList,
      canUseCrypto,
      hasAppLockSecret
    });
    renderSyncControls();
  }

  function renderSyncControls() {
    const syncSettings = getState()?.settings?.sync || {};
    const mode = syncSettings.mode === "off" ? "off" : "hosted";
    if (els.syncE2eeToggle) {
      const enc = syncSettings.encryption === "e2ee" ? "e2ee" : "none";
      els.syncE2eeToggle.value = enc;
    }
    if (els.syncMode) {
      els.syncMode.value = mode;
    }
    if (els.syncEndpoint) {
      const endpoint = syncSettings.endpoint || "";
      els.syncEndpoint.value = endpoint && endpoint !== "/api/sync/v1" ? endpoint : "";
    }
    if (els.syncNowBtn) {
      els.syncNowBtn.disabled = mode !== "hosted";
    }
    if (els.syncStatusLine) {
      const syncMeta = getState()?.meta?.sync || {};
      let label = "—";
      if (mode === "off") {
        label = "Paused";
      } else if (syncMeta.status === "syncing") {
        label = "Syncing";
      } else if (syncMeta.status === "idle" || syncMeta.status === "") {
        label = "Idle";
      } else if (syncMeta.status === "error") {
        label = "Error";
      } else if (syncMeta.status === "offline") {
        label = "Offline";
      }
      const pending = Number.isFinite(syncMeta.pendingOutbox) ? syncMeta.pendingOutbox : 0;
      const suffix = pending > 0 ? ` • ${pending} pending` : "";
      els.syncStatusLine.textContent = `Status: ${label}${suffix}`;
    }
    if (els.syncLinkStatus && typeof actions.getSyncLink === "function") {
      actions.getSyncLink()
        .then((link) => {
          if (!els.syncLinkStatus) return;
          const base = link
            ? "Sync link ready. Keep it private."
            : "No sync link configured.";
          els.syncLinkStatus.textContent = (mode === "off") ? `Sync paused. ${base}` : base;
        })
        .catch(() => {
          if (!els.syncLinkStatus) return;
          els.syncLinkStatus.textContent = "Sync link unavailable.";
        });
    }
  }

  function markAllViewsDirty() {
    dirtyViews.add("today");
    dirtyViews.add("history");
    dirtyViews.add("review");
    dirtyViews.add("settings");
  }

  function markViewDirty(view) {
    dirtyViews.add(view);
  }

  function renderActive() {
    applyUiPreferences();
    applyHomeRedaction();
    renderSyncStatus();
    if (activeTab === "history") {
      if (dirtyViews.has("history")) {
        renderHistory();
        dirtyViews.delete("history");
      }
      return;
    }
    if (activeTab === "review") {
      if (dirtyViews.has("review")) {
        renderReview();
        dirtyViews.delete("review");
      }
      return;
    }
    if (activeTab === "settings") {
      if (dirtyViews.has("settings")) {
        renderSettings();
        dirtyViews.delete("settings");
      }
      return;
    }
    if (dirtyViews.has("today")) {
      renderToday();
      dirtyViews.delete("today");
    }
  }

  const renderScheduler = createRenderScheduler({
    main: () => renderActive(),
    overlays: () => {
      applyAppLock();
      refreshPrivacyBlur();
    }
  });

  function queueRender(region = "main") {
    renderScheduler.markDirty(region);
  }

  function queueRenderAll() {
    markAllViewsDirty();
    renderScheduler.renderAll();
  }

  function renderAll() {
    queueRenderAll();
  }

  function wire() {
    // tabs
    els.tabToday.addEventListener("click", () => { setActiveTab("today"); queueRender("main"); });
    els.tabHistory.addEventListener("click", () => { setActiveTab("history"); queueRender("main"); });
    els.tabReview.addEventListener("click", () => { setActiveTab("review"); queueRender("main"); });
    els.tabSettings.addEventListener("click", () => { setActiveTab("settings"); queueRender("main"); });

    if (els.appLockSubmit) {
      els.appLockSubmit.addEventListener("click", () => {
        attemptUnlock();
      });
    }
    if (els.appLockInput) {
      els.appLockInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          attemptUnlock();
        }
      });
    }

    if (els.reviewInsights) {
      els.reviewInsights.addEventListener("click", (e) => {
        if (blockIfSafeMode()) return;
        const btn = e.target.closest("button[data-action='dismiss-insight']");
        if (!btn) return;
        if (typeof actions.dismissInsight !== "function") return;
        const insightId = btn.dataset.insightId || "";
        if (!insightId) return;
        const insight = reviewInsights.find((item) => item.id === insightId);
        if (!insight) return;
        actions.dismissInsight(insight);
        markViewDirty("review");
        queueRender("main");
      });
    }

    const shiftReviewWeek = (delta) => {
      const base = reviewAnchorDate || getCurrentDate();
      reviewAnchorDate = addDays(base, delta * 7);
      markViewDirty("review");
      queueRender("main");
    };
    if (els.reviewPrevWeek) {
      els.reviewPrevWeek.addEventListener("click", () => shiftReviewWeek(-1));
    }
    if (els.reviewNextWeek) {
      els.reviewNextWeek.addEventListener("click", () => shiftReviewWeek(1));
    }
    if (els.reviewTodayWeek) {
      els.reviewTodayWeek.addEventListener("click", () => {
        reviewAnchorDate = new Date();
        markViewDirty("review");
        queueRender("main");
      });
    }

    if (els.auditFilter) {
      els.auditFilter.addEventListener("change", () => {
        renderAuditLogComponent({
          container: els.auditLogList,
          list: diagState.auditLogCache,
          filter: els.auditFilter ? els.auditFilter.value : "all",
          formatSnapshotTime,
          escapeHtml
        });
      });
    }
    if (els.perfLogToggle) {
      els.perfLogToggle.addEventListener("change", () => {
        const enabled = !!els.perfLogToggle.checked;
        setPerfLogging(enabled);
        showUndoToast(enabled ? "Perf logging enabled" : "Perf logging disabled");
      });
    }

    if (els.historyLoadMore) {
      els.historyLoadMore.addEventListener("click", () => {
        diagState.historyPage++;
        renderHistory();
      });
    }

    if (els.historySearch) {
      historyFilters.query = els.historySearch.value || "";
      els.historySearch.addEventListener("input", () => {
        historyFilters.query = els.historySearch.value || "";
        markViewDirty("history");
        queueRender("main");
      });
    }
    if (els.historyFilters) {
      els.historyFilters.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-filter]");
        if (!btn) return;
        const key = btn.dataset.filter || "";
        if (!key) return;
        const next = !historyFilters.flags[key];
        historyFilters.flags[key] = next;
        btn.classList.toggle("active", next);
        markViewDirty("history");
        queueRender("main");
      });
    }
    if (els.historyList) {
      els.historyList.addEventListener("click", (e) => {
        const actionEl = e.target.closest("[data-action]");
        if (!actionEl) return;
        const action = actionEl.dataset.action || "";
        const dateKey = actionEl.dataset.date || "";
        const field = actionEl.dataset.field || "";
        if (action === "toggle-details") {
          if (!dateKey) return;
          if (historyOpenDays.has(dateKey)) {
            historyOpenDays.delete(dateKey);
          } else {
            historyOpenDays.add(dateKey);
          }
          markViewDirty("history");
          queueRender("main");
          return;
        }
        if (action === "open-day") {
          if (!dateKey) return;
          setCurrentDate(new Date(dateKey + "T12:00:00"));
          setActiveTab("today");
          markViewDirty("today");
          queueRender("main");
          return;
        }
        if (action === "copy-prev") {
          if (blockIfSafeMode()) return;
          if (!dateKey || typeof actions.copyYesterday !== "function") return;
          if (typeof actions.canCopyYesterday === "function" && !actions.canCopyYesterday(dateKey)) {
            showUndoToast("No previous day to copy");
            return;
          }
          captureUndo("Copied previous day", () => actions.copyYesterday(dateKey));
          markViewDirty("history");
          markViewDirty("today");
          queueRender("main");
          return;
        }
        if (action === "edit-seg") {
          if (blockIfSafeMode()) return;
          const segId = actionEl.dataset.seg || "";
          if (!dateKey || !segId) return;
          setCurrentDate(new Date(dateKey + "T12:00:00"));
          openSegment(dateKey, segId);
          return;
        }
        if (action === "toggle-bool") {
          if (blockIfSafeMode()) return;
          if (!dateKey || !field) return;
          captureUndo("Day toggle", () => actions.toggleBoolField(dateKey, field));
          markViewDirty("history");
          markViewDirty("today");
          queueRender("main");
          return;
        }
        if (action === "set-tri") {
          if (blockIfSafeMode()) return;
          if (!dateKey || !field) return;
          const value = actionEl.dataset.value || "auto";
          captureUndo("Day flag", () => actions.setDayField(dateKey, field, value));
          markViewDirty("history");
          markViewDirty("today");
          queueRender("main");
          return;
        }
        if (action === "set-signal") {
          if (blockIfSafeMode()) return;
          if (!dateKey || !field) return;
          const value = actionEl.dataset.value || "";
          captureUndo("Signal updated", () => actions.setDayField(dateKey, field, value));
          markViewDirty("history");
          markViewDirty("today");
          queueRender("main");
        }
      });
      els.historyList.addEventListener("input", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLTextAreaElement)) return;
        if (target.dataset.action !== "set-notes") return;
        const dateKey = target.dataset.date || "";
        if (!dateKey) return;
        if (blockIfSafeMode()) return;
        if (historyNotesTimers.has(dateKey)) {
          clearTimeout(historyNotesTimers.get(dateKey));
        }
        const timer = setTimeout(() => {
          historyNotesTimers.delete(dateKey);
          captureUndo("Notes updated", () => actions.setDayField(dateKey, "notes", target.value || ""));
          markViewDirty("history");
          markViewDirty("today");
          queueRender("main");
        }, 320);
        historyNotesTimers.set(dateKey, timer);
      });
      els.historyList.addEventListener("change", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLTextAreaElement)) return;
        if (target.dataset.action !== "set-notes") return;
        const dateKey = target.dataset.date || "";
        if (!dateKey) return;
        if (historyNotesTimers.has(dateKey)) {
          clearTimeout(historyNotesTimers.get(dateKey));
          historyNotesTimers.delete(dateKey);
        }
        const value = target.value || "";
        if (blockIfSafeMode()) return;
        captureUndo("Notes updated", () => actions.setDayField(dateKey, "notes", value));
        markViewDirty("history");
        markViewDirty("today");
        queueRender("main");
      });
    }

    // date nav
    els.prevDay.addEventListener("click", () => { setCurrentDate(addDays(getCurrentDate(), -1)); markViewDirty("today"); queueRender("main"); });
    els.nextDay.addEventListener("click", () => { setCurrentDate(addDays(getCurrentDate(), 1)); markViewDirty("today"); queueRender("main"); });
    els.datePicker.addEventListener("change", () => {
      if (els.datePicker.value) {
        setCurrentDate(new Date(els.datePicker.value + "T12:00:00"));
        markViewDirty("today");
        queueRender("main");
      }
    });
    if (els.copyYesterday) {
      els.copyYesterday.addEventListener("click", copyYesterdayIntoToday);
    }
    if (els.fabEdit) {
      els.fabEdit.addEventListener("click", () => {
        if (blockIfSafeMode()) return;
        const dateKey = yyyyMmDd(getCurrentDate());
        const defs = getSegmentDefs(getState().settings);
        if (!defs.length) return;
        let segId = defs[0].id;
        if (dateKey === getActiveDateKey()) {
          const now = nowMinutes();
          const nowLifted = liftMinuteToTimeline(now, defs[0].start);
          segId = whichSegment(nowLifted, defs);
        }
        openSegment(dateKey, segId);
      });
    }
    if (els.todayNudgeDismiss) {
      els.todayNudgeDismiss.addEventListener("click", () => {
        if (blockIfSafeMode()) return;
        if (!todayNudgeInsight) return;
        actions.dismissInsight?.(todayNudgeInsight);
        todayNudgeInsight = null;
        markViewDirty("today");
        queueRender("main");
      });
    }
    if (els.diagMissingItems) {
      els.diagMissingItems.addEventListener("click", () => {
        if (blockIfSafeMode()) return;
        if (!missingRosterItems || missingRosterItems.size === 0) return;
        if (typeof actions.addRosterItemWithId !== "function") return;
        const ok = confirm(`Repair ${missingRosterItems.size} missing roster IDs?`);
        if (!ok) return;
        for (const [id, category] of missingRosterItems) {
          const shortId = String(id).slice(0, 8);
          const label = prompt(
            `Missing roster ID in ${category}: ${id}\nEnter label to create (blank to skip).`,
            `Missing ${shortId}`
          );
          if (label === null) break;
          const trimmed = label.trim();
          if (!trimmed) continue;
          actions.addRosterItemWithId(category, id, trimmed);
        }
        markAllViewsDirty();
        queueRender("main");
      });
    }

    // focus toggle
    els.toggleFocus.addEventListener("click", () => {
      if (blockIfSafeMode()) return;
      actions.toggleFocusMode();
      markViewDirty("today");
      queueRender("main");
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
      captureUndo("High-fat day", () => actions.toggleTriField(dateKey, "highFatDay"));
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

    if (els.supplementsNotes) {
      els.supplementsNotes.addEventListener("input", () => {
        const dateKey = yyyyMmDd(getCurrentDate());
        clearTimeout(supplementsNotesDebounce);
        supplementsNotesDebounce = setTimeout(() => {
          if (typeof actions.setSupplementsNotes !== "function") return;
          captureUndo("Supplements notes updated", () => actions.setSupplementsNotes(dateKey, els.supplementsNotes.value || ""));
        }, 320);
      });
    }

    // history export/import
    if (els.exportBtn) {
      els.exportBtn.addEventListener("click", (e) => {
        const mode = e.currentTarget?.dataset?.mode || "";
        actions.exportState(mode || undefined);
      });
    }
    if (els.exportAltBtn) {
      els.exportAltBtn.addEventListener("click", (e) => {
        const mode = e.currentTarget?.dataset?.mode || "";
        actions.exportState(mode || undefined);
      });
    }
    if (els.exportCsvBtn) {
      els.exportCsvBtn.addEventListener("click", () => {
        if (typeof actions.exportCsv === "function") {
          actions.exportCsv();
        }
      });
    }
    if (els.safeModeExport) {
      els.safeModeExport.addEventListener("click", () => {
        actions.exportState("plain");
      });
    }
    if (els.importMode) {
      setSegmentedActive(els.importMode, "merge");
      els.importMode.addEventListener("click", (e) => {
        const btn = e.target.closest(".seg-btn");
        if (!btn) return;
        setSegmentedActive(els.importMode, btn.dataset.value);
      });
    }

    els.importFile.addEventListener("change", async () => {
      const f = els.importFile.files && els.importFile.files[0];
      if (!f) {
        els.importFile.value = "";
        clearPendingImport();
        return;
      }

      let text = "";
      try {
        text = await f.text();
      } catch (err) {
        console.error(err);
        setImportStatus("Import failed: could not read file.", true);
        clearPendingImport();
        els.importFile.value = "";
        return;
      }

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch (err) {
        console.error(err);
        setImportStatus("Import failed: invalid JSON.", true);
        clearPendingImport();
        els.importFile.value = "";
        return;
      }

      if (payload && payload.type === "shredmaxx:encrypted") {
        if (typeof actions.decryptImportPayload !== "function") {
          setImportStatus("Import failed: encrypted payloads not supported here.", true);
          clearPendingImport();
          els.importFile.value = "";
          return;
        }
        const passphrase = prompt("Enter passphrase to decrypt this import:");
        if (!passphrase) {
          setImportStatus("Import canceled: passphrase required.", true);
          clearPendingImport();
          els.importFile.value = "";
          return;
        }
        const decrypted = await actions.decryptImportPayload(payload, passphrase);
        if (!decrypted || !decrypted.ok) {
          setImportStatus(decrypted?.error || "Import failed: decrypt error.", true);
          clearPendingImport();
          els.importFile.value = "";
          return;
        }
        payload = decrypted.payload;
      }

      const validation = actions.validateImportPayload(payload);
      if (!validation.ok) {
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

    if (els.importApply) {
      els.importApply.addEventListener("click", async () => {
        if (!pendingImport) {
          setImportStatus("Choose an import file first.", true);
          return;
        }
        const mode = getImportMode();
        if (mode === "replace") {
          const ok = confirm("Replace will overwrite your current logs and rosters. Continue?");
          if (!ok) return;
        }

        const result = await actions.applyImportPayload(pendingImport, mode);
        if (!result.ok) {
          setImportStatus(result.error || "Import failed.", true);
          return;
        }

        clearPendingImport();
        renderAll();
        setImportStatus(`Import ${mode} complete.`, false);
      });
    }

    if (els.snapshotCreate) {
      els.snapshotCreate.addEventListener("click", async () => {
        if (typeof actions.createSnapshot !== "function") return;
        try {
          undoState = null;
          await actions.createSnapshot("Manual snapshot");
          renderDiagnostics();
          showUndoToast("Snapshot saved");
        } catch (e) {
          showUndoToast("Snapshot failed");
        }
      });
    }

    if (els.appLockSetBtn) {
      els.appLockSetBtn.addEventListener("click", async () => {
        if (blockIfSafeMode()) return;
        if (!canUseCrypto()) {
          alert("App lock requires WebCrypto.");
          return;
        }
        const enabled = isAppLockEnabled() || !!els.privacyAppLockToggle?.checked;
        if (enabled && hasAppLockSecret()) {
          const ok = await verifyExistingPasscode("Enter current passcode:");
          if (!ok) return;
        }
        const ok = await ensureAppLockPasscode();
        if (!ok) return;
        if (els.privacyAppLockToggle && !els.privacyAppLockToggle.checked) {
          els.privacyAppLockToggle.checked = true;
        }
        if (!isAppLockEnabled()) {
          captureUndo("App lock enabled", () => actions.updateSettings({ privacy: { appLock: true } }));
          appLocked = false;
          refreshAppLock();
        }
        showUndoToast(enabled ? "Passcode changed" : "Passcode set");
      });
    }

    if (els.syncLinkApply) {
      els.syncLinkApply.addEventListener("click", async () => {
        if (blockIfSafeMode()) return;
        const link = els.syncLinkInput?.value || "";
        if (!link.trim()) {
          alert("Paste a sync link first.");
          return;
        }
        if (typeof actions.applySyncLink !== "function") return;
        const result = await actions.applySyncLink(link.trim());
        if (!result?.ok) {
          alert(result?.error || "Sync link failed.");
          return;
        }
        els.syncLinkInput.value = "";
        if (result.e2ee && typeof actions.setSyncPassphrase === "function") {
          const passphrase = prompt("Enter sync passphrase:");
          if (passphrase) {
            await actions.setSyncPassphrase(passphrase);
          }
        }
        renderSyncControls();
        showUndoToast("Sync link applied");
      });
    }

    if (els.syncLinkCopy) {
      els.syncLinkCopy.addEventListener("click", async () => {
        if (typeof actions.getSyncLink !== "function") return;
        const link = await actions.getSyncLink();
        if (!link) {
          alert("No sync link configured yet.");
          return;
        }
        try {
          await navigator.clipboard.writeText(link);
          showUndoToast("Sync link copied");
        } catch (e) {
          prompt("Copy your sync link:", link);
        }
      });
    }

    if (els.syncNowBtn) {
      els.syncNowBtn.addEventListener("click", async () => {
        if (blockIfSafeMode()) return;
        if (typeof actions.syncNow !== "function") return;
        await actions.syncNow();
        renderSyncControls();
      });
    }

    if (els.syncResetSpace) {
      els.syncResetSpace.addEventListener("click", async () => {
        if (blockIfSafeMode()) return;
        const ok = confirm("Reset sync space? This clears credentials and outbox.");
        if (!ok) return;
        if (typeof actions.resetSyncSpace !== "function") return;
        await actions.resetSyncSpace();
        renderSyncControls();
        showUndoToast("Sync reset");
      });
    }

    if (els.syncE2eeToggle) {
      els.syncE2eeToggle.addEventListener("change", async () => {
        if (blockIfSafeMode()) return;
        const prev = getState()?.settings?.sync?.encryption === "e2ee" ? "e2ee" : "none";
        const next = els.syncE2eeToggle.value === "e2ee" ? "e2ee" : "none";
        if (typeof actions.setSyncEncryption !== "function") return;
        if (next === "e2ee") {
          const passphrase = prompt("Set a sync passphrase (required):");
          if (!passphrase) {
            els.syncE2eeToggle.value = prev;
            return;
          }
          const confirmPass = prompt("Confirm passphrase:");
          if (confirmPass !== passphrase) {
            alert("Passphrases did not match.");
            els.syncE2eeToggle.value = prev;
            return;
          }
          const result = await actions.setSyncEncryption("e2ee", passphrase);
          if (!result?.ok) {
            alert(result?.error || "Failed to enable E2EE.");
            els.syncE2eeToggle.value = prev;
            if (result?.error && els.syncLinkStatus) {
              els.syncLinkStatus.textContent = result.error;
            }
          }
        } else {
          const result = await actions.setSyncEncryption("none");
          if (!result?.ok && result?.error && els.syncLinkStatus) {
            els.syncLinkStatus.textContent = result.error;
          }
        }
      });
    }

    // settings save/reset
    els.saveSettings.addEventListener("click", async () => {
      if (blockIfSafeMode()) return;
      const parsedWeekStart = Number.parseInt(els.setWeekStart?.value || "", 10);
      const existingPrivacy = getState().settings?.privacy || {};
      let nextAppLock = !!els.privacyAppLockToggle?.checked;
      const wasAppLock = !!existingPrivacy.appLock;
      const hasPasscode = hasAppLockSecret();
      const blurOnBackground = !!els.privacyBlurToggle?.checked;
      const redactHome = !!els.privacyRedactToggle?.checked;
      const exportEncryptedByDefault = !!els.privacyEncryptedToggle?.checked;
      const nudgesEnabled = !!els.todayNudgeToggle?.checked;
      const syncEncryption = els.syncE2eeToggle?.value === "e2ee" ? "e2ee" : "none";
      const existingSync = getState().settings?.sync || {};
      const syncMode = els.syncMode?.value || existingSync.mode || "hosted";
      const syncEndpoint = (els.syncEndpoint?.value || "").trim();

      if (nextAppLock && !hasPasscode) {
        const ok = await ensureAppLockPasscode();
        if (!ok) {
          nextAppLock = false;
          if (els.privacyAppLockToggle) els.privacyAppLockToggle.checked = false;
        }
      } else if (!nextAppLock && wasAppLock) {
        if (hasPasscode) {
          if (!canUseCrypto()) {
            clearAppLockRecord();
            appLocked = false;
          } else {
            const ok = await verifyExistingPasscode("Enter passcode to disable app lock:");
            if (!ok) {
              nextAppLock = true;
              if (els.privacyAppLockToggle) els.privacyAppLockToggle.checked = true;
            } else {
              clearAppLockRecord();
              appLocked = false;
            }
          }
        } else {
          clearAppLockRecord();
          appLocked = false;
        }
      }

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
        focusMode: els.setFocusMode.value || "nowfade",
        weekStart: Number.isFinite(parsedWeekStart) ? parsedWeekStart : defaults.DEFAULT_SETTINGS.weekStart,
        nudgesEnabled,
        supplementsMode: els.setSupplementsMode?.value || "none",
        sync: {
          ...existingSync,
          mode: syncMode,
          endpoint: syncEndpoint,
          encryption: syncEncryption
        },
        privacy: {
          appLock: nextAppLock,
          redactHome,
          exportEncryptedByDefault,
          blurOnBackground
        }
      };

      captureUndo("Settings saved", () => actions.updateSettings(s));
      renderAll();
      refreshAppLock();
      alert("Saved.");
    });

    els.setSunMode.addEventListener("change", () => {
      const autoSun = els.setSunMode.value === "auto";
      els.setSunrise.disabled = autoSun;
      els.setSunset.disabled = autoSun;
      if (autoSun) {
        setSunAutoStatus("Auto active • tap Update from location");
      } else {
        setSunAutoStatus("Auto off • tap Update from location to enable");
      }
    });

    if (els.sunAutoBtn) {
      els.sunAutoBtn.addEventListener("click", updateSunTimesFromLocation);
    }

    if (els.privacyBlurToggle) {
      els.privacyBlurToggle.addEventListener("change", () => {
        const enabled = !!els.privacyBlurToggle.checked;
        if (blockIfSafeMode()) {
          els.privacyBlurToggle.checked = !!getState().settings?.privacy?.blurOnBackground;
          return;
        }
        captureUndo("Privacy blur updated", () => actions.updateSettings({ privacy: { blurOnBackground: enabled } }));
        refreshPrivacyBlur();
      });
    }

    if (els.privacyRedactToggle) {
      els.privacyRedactToggle.addEventListener("change", () => {
        const enabled = !!els.privacyRedactToggle.checked;
        if (blockIfSafeMode()) {
          els.privacyRedactToggle.checked = !!getState().settings?.privacy?.redactHome;
          return;
        }
        captureUndo("Home redaction updated", () => actions.updateSettings({ privacy: { redactHome: enabled } }));
        markViewDirty("today");
        queueRender("main");
      });
    }

    document.addEventListener("visibilitychange", () => {
      refreshPrivacyBlur();
      if (isAppLockEnabled() && document.hidden) {
        appLocked = true;
      }
      refreshAppLock();
    });

    els.resetToday.addEventListener("click", () => {
      const k = getActiveDateKey();
      if (confirm("Reset today's logs?")) {
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
        if (!name) return;
        captureUndo("Roster item added", () => actions.addRosterItem(cat, name));
        markViewDirty("settings");
        markViewDirty("today");
        queueRender("main");
      });
    });

    wireRosterContainer("proteins", els.rosterProteins);
    wireRosterContainer("carbs", els.rosterCarbs);
    wireRosterContainer("fats", els.rosterFats);
    wireRosterContainer("micros", els.rosterMicros);
    if (els.rosterSupplements) {
      wireRosterContainer("supplements", els.rosterSupplements);
    }

    wireSegmentEditor({
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
      getRosterSearch: () => rosterSearch,
      setRosterSearch: (next) => { rosterSearch = next; },
      searchInputs,
      captureUndo,
      markViewDirty,
      queueRender,
      yyyyMmDd,
      logPerf,
      setSegNotesTimer: (fn, delay) => {
        clearTimeout(segNotesTimer);
        segNotesTimer = setTimeout(fn, delay);
      }
    });

    if (els.undoAction) {
      els.undoAction.addEventListener("click", () => {
        if (!undoState) return;
        actions.replaceState(undoState);
        undoState = null;
        hideUndoToast();
        renderAll();
      });
    }
  }

  function startTicks() {
    // tick (sun position + now marker)
    setInterval(() => {
      const dateKey = yyyyMmDd(getCurrentDate());
      if (dateKey === getActiveDateKey()) {
        renderSolarArc(dateKey);
        applyFutureFog(dateKey);
      }
    }, 20_000);
  }

  function init() {
    wire();
    appLocked = isAppLockEnabled() && hasAppLockSecret() && canUseCrypto();
    setActiveTab("today");
    // [SB-06] Immediately render time to avoid --:-- flash
    renderCurrentTime(yyyyMmDd(getCurrentDate()));
    renderAll();
    refreshAppLock();
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
