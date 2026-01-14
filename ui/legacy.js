// @ts-check

import { effectiveSegmentFlags, normalizeTri } from "../domain/heuristics.js";
import { computeSegmentWindows } from "../domain/time.js";
import { searchRosterItems } from "../domain/search.js";
import { computeRotationPicks } from "../domain/rotation.js";
import { computeInsights } from "../domain/insights.js";
import { computeWeeklySummary } from "../domain/weekly.js";

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

  let segmentEls = {};
  let notesDebounce = null;
  let segNotesTimer = null;
  let supplementsNotesDebounce = null;
  let pendingImport = null;
  let pendingImportName = "";
  let diagSnapshotSeq = 0;
  let rosterSearch = {
    proteins: "",
    carbs: "",
    fats: "",
    micros: ""
  };
  let undoState = null;
  let undoTimer = null;
  let reviewInsights = [];
  let todayNudgeInsight = null;
  const APP_LOCK_HASH_KEY = "shredmaxx_app_lock_hash";
  const APP_LOCK_SALT_KEY = "shredmaxx_app_lock_salt";
  const appLockEncoder = (typeof TextEncoder !== "undefined") ? new TextEncoder() : null;
  let appLocked = false;

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

  function refreshPrivacyBlur(){
    applyPrivacyBlur();
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

  function segmentHasContent(seg, segId){
    if(!seg) return false;
    const hasItems = seg.proteins.length || seg.carbs.length || seg.fats.length || seg.micros.length;
    const hasFlags = (seg.collision && seg.collision !== "auto") || (seg.highFatMeal && seg.highFatMeal !== "auto") || seg.seedOil || seg.notes;
    const hasFtn = segId === "ftn" && seg.ftnMode;
    return !!(hasItems || hasFlags || hasFtn);
  }

  function dayHasDailyContent(day){
    if(!day) return false;
    return !!(day.movedBeforeLunch || day.trained || day.highFatDay || day.energy || day.mood || day.cravings || day.notes);
  }

  function formatLatLon(lat, lon){
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }

  function setSunAutoStatus(text){
    if(!els.sunAutoStatus) return;
    els.sunAutoStatus.textContent = text || "";
  }

  function updateSunTimesFromLocation(){
    if(!navigator || !navigator.geolocation){
      setSunAutoStatus("Geolocation not available in this browser.");
      showUndoToast("Geolocation unavailable");
      if(getState().settings.sunMode === "auto"){
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
      if(!result || result.status !== "ok" || result.sunrise == null || result.sunset == null){
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
      if(getState().settings.sunMode === "auto"){
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

  function applyPrivacyBlur(){
    if(!els.privacyBlurOverlay) return;
    const enabled = !!getState()?.settings?.privacy?.blurOnBackground;
    const isHidden = (typeof document.visibilityState === "string")
      ? document.visibilityState !== "visible"
      : !!document.hidden;
    const shouldShow = enabled && isHidden;
    els.privacyBlurOverlay.classList.toggle("hidden", !shouldShow);
    els.privacyBlurOverlay.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  }

  function canUseCrypto(){
    return !!(appLockEncoder && globalThis.crypto && crypto.subtle && crypto.getRandomValues);
  }

  function bytesToBase64(bytes){
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  function base64ToBytes(str){
    try{
      const binary = atob(str || "");
      const out = new Uint8Array(binary.length);
      for(let i = 0; i < binary.length; i++){
        out[i] = binary.charCodeAt(i);
      }
      return out;
    }catch(e){
      return new Uint8Array();
    }
  }

  function readAppLockRecord(){
    try{
      if(typeof localStorage === "undefined") return { hash: "", salt: "" };
      return {
        hash: localStorage.getItem(APP_LOCK_HASH_KEY) || "",
        salt: localStorage.getItem(APP_LOCK_SALT_KEY) || ""
      };
    }catch(e){
      return { hash: "", salt: "" };
    }
  }

  function writeAppLockRecord(hash, salt){
    try{
      if(typeof localStorage === "undefined") return false;
      localStorage.setItem(APP_LOCK_HASH_KEY, hash);
      localStorage.setItem(APP_LOCK_SALT_KEY, salt);
      return true;
    }catch(e){
      return false;
    }
  }

  function clearAppLockRecord(){
    try{
      if(typeof localStorage === "undefined") return;
      localStorage.removeItem(APP_LOCK_HASH_KEY);
      localStorage.removeItem(APP_LOCK_SALT_KEY);
    }catch(e){
      // ignore
    }
  }

  async function hashPasscode(passcode, saltBytes){
    if(!canUseCrypto()) return "";
    const passBytes = appLockEncoder.encode(String(passcode));
    const data = new Uint8Array(saltBytes.length + passBytes.length);
    data.set(saltBytes, 0);
    data.set(passBytes, saltBytes.length);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return bytesToBase64(new Uint8Array(digest));
  }

  function hasAppLockSecret(){
    const record = readAppLockRecord();
    return !!(record.hash && record.salt);
  }

  function isAppLockEnabled(){
    return !!getState()?.settings?.privacy?.appLock;
  }

  async function verifyAppLockPasscode(passcode){
    if(!canUseCrypto()) return false;
    const record = readAppLockRecord();
    if(!record.hash || !record.salt) return false;
    const saltBytes = base64ToBytes(record.salt);
    if(!saltBytes.length) return false;
    const nextHash = await hashPasscode(passcode, saltBytes);
    return nextHash === record.hash;
  }

  async function setAppLockPasscode(passcode){
    if(!canUseCrypto()) return false;
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const hash = await hashPasscode(passcode, saltBytes);
    if(!hash) return false;
    return writeAppLockRecord(hash, bytesToBase64(saltBytes));
  }

  function setAppLockMessage(msg){
    if(!els.appLockMessage) return;
    els.appLockMessage.textContent = msg || "";
  }

  function showAppLockOverlay(msg){
    if(!els.appLockOverlay) return;
    els.appLockOverlay.classList.remove("hidden");
    els.appLockOverlay.setAttribute("aria-hidden", "false");
    setAppLockMessage(msg || "");
    if(els.appLockInput){
      els.appLockInput.value = "";
      setTimeout(() => els.appLockInput?.focus(), 50);
    }
  }

  function hideAppLockOverlay(){
    if(!els.appLockOverlay) return;
    els.appLockOverlay.classList.add("hidden");
    els.appLockOverlay.setAttribute("aria-hidden", "true");
    setAppLockMessage("");
  }

  function refreshAppLock(){
    if(!els.appLockOverlay) return;
    const enabled = isAppLockEnabled();
    const hasSecret = hasAppLockSecret();
    if(!enabled || !hasSecret){
      appLocked = false;
      hideAppLockOverlay();
      return;
    }
    if(appLocked){
      showAppLockOverlay("Enter your passcode to continue.");
    }else{
      hideAppLockOverlay();
    }
  }

  async function attemptUnlock(){
    if(!canUseCrypto()){
      setAppLockMessage("App lock requires WebCrypto.");
      return;
    }
    if(!els.appLockInput) return;
    const passcode = els.appLockInput.value || "";
    if(!passcode){
      setAppLockMessage("Enter passcode.");
      return;
    }
    const ok = await verifyAppLockPasscode(passcode);
    if(ok){
      appLocked = false;
      refreshAppLock();
    }else{
      setAppLockMessage("Incorrect passcode.");
      els.appLockInput.value = "";
    }
  }

  function promptNewPasscode(){
    const passcode = prompt("Set a passcode (4+ characters):");
    if(!passcode) return null;
    if(passcode.length < 4){
      alert("Passcode too short.");
      return null;
    }
    const confirmPass = prompt("Confirm passcode:");
    if(confirmPass !== passcode){
      alert("Passcodes did not match.");
      return null;
    }
    return passcode;
  }

  async function ensureAppLockPasscode(){
    if(!canUseCrypto()){
      alert("App lock requires WebCrypto.");
      return false;
    }
    const passcode = promptNewPasscode();
    if(!passcode) return false;
    const stored = await setAppLockPasscode(passcode);
    if(!stored){
      alert("Failed to store passcode.");
      return false;
    }
    return true;
  }

  async function verifyExistingPasscode(actionLabel){
    if(!canUseCrypto()){
      alert("App lock requires WebCrypto.");
      return false;
    }
    const passcode = prompt(actionLabel || "Enter passcode:");
    if(!passcode) return false;
    const ok = await verifyAppLockPasscode(passcode);
    if(!ok){
      alert("Incorrect passcode.");
    }
    return ok;
  }

  function getSegmentTimestamp(seg, day){
    const ts = seg?.tsLast || seg?.tsFirst || day?.tsLast || day?.tsCreated;
    if(!ts) return null;
    const parsed = Date.parse(ts);
    if(!Number.isFinite(parsed)) return null;
    return parsed;
  }

  function findLastLoggedSegment(){
    const state = getState();
    let best = null;
    let bestTs = -Infinity;
    for(const [dateKey, day] of Object.entries(state.logs || {})){
      const segments = day?.segments || {};
      for(const [segId, seg] of Object.entries(segments)){
        if(!segmentHasContent(seg, segId)) continue;
        const ts = getSegmentTimestamp(seg, day);
        if(ts === null) continue;
        if(ts > bestTs){
          bestTs = ts;
          best = { dateKey, segId, seg };
        }
      }
    }
    return best;
  }

  function repeatLastSegment(dateKey, segId){
    const last = findLastLoggedSegment();
    if(!last){
      undoState = null;
      showUndoToast("No recent segment to copy");
      return;
    }
    captureUndo("Segment repeated", () => actions.copySegment(dateKey, segId, last.seg));
    updateSegmentVisual(dateKey, segId);
    if(getCurrentSegmentId() === segId && !els.sheet.classList.contains("hidden")){
      openSegment(dateKey, segId);
    }
  }

  function parseCopySegments(input){
    const raw = String(input || "").trim().toLowerCase();
    if(!raw) return { segments: [], includeDaily: false };
    if(raw === "all" || raw === "day"){
      return { segments: ["ftn", "lunch", "dinner", "late"], includeDaily: true };
    }
    const map = {
      ftn: "ftn",
      lunch: "lunch",
      dinner: "dinner",
      late: "late"
    };
    const parts = raw.split(/[, ]+/).map(p => p.trim()).filter(Boolean);
    const segments = [];
    for(const part of parts){
      const id = map[part];
      if(id && !segments.includes(id)) segments.push(id);
    }
    return { segments, includeDaily: false };
  }

  function copyYesterdayIntoToday(){
    if(typeof actions.copySegment !== "function") return;
    const targetKey = yyyyMmDd(getCurrentDate());
    const yesterdayKey = yyyyMmDd(addDays(getCurrentDate(), -1));
    const state = getState();
    if(!state.logs || !state.logs[yesterdayKey]){
      undoState = null;
      showUndoToast("No log for yesterday");
      return;
    }

    const choice = prompt("Copy yesterday: type \"all\" or list segments (ftn, lunch, dinner, late).", "all");
    if(choice === null) return;
    const parsed = parseCopySegments(choice);
    if(parsed.segments.length === 0){
      undoState = null;
      showUndoToast("No segments selected");
      return;
    }

    const targetDay = getDay(targetKey);
    const willOverwriteSegments = parsed.segments.some((segId) => segmentHasContent(targetDay.segments[segId], segId));
    const willOverwriteDaily = parsed.includeDaily && dayHasDailyContent(targetDay);
    if(willOverwriteSegments || willOverwriteDaily){
      const ok = confirm("Copy will overwrite existing data for the selected segments. Continue?");
      if(!ok) return;
    }

    const sourceDay = getDay(yesterdayKey);
    captureUndo("Copied yesterday", () => {
      for(const segId of parsed.segments){
        const sourceSeg = sourceDay.segments?.[segId];
        if(sourceSeg){
          actions.copySegment(targetKey, segId, sourceSeg);
        }
      }
      if(parsed.includeDaily){
        actions.setDayField(targetKey, "movedBeforeLunch", !!sourceDay.movedBeforeLunch);
        actions.setDayField(targetKey, "trained", !!sourceDay.trained);
        actions.setDayField(targetKey, "highFatDay", !!sourceDay.highFatDay);
        actions.setDayField(targetKey, "energy", sourceDay.energy || "");
        actions.setDayField(targetKey, "mood", sourceDay.mood || "");
        actions.setDayField(targetKey, "cravings", sourceDay.cravings || "");
        actions.setDayField(targetKey, "notes", sourceDay.notes || "");
      }
    });

    renderAll();
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

      let longPressTimer = null;
      let longPressFired = false;

      const clearLongPress = () => {
        if(longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = null;
      };

      segEl.addEventListener("pointerdown", (e) => {
        if(e.button !== undefined && e.button !== 0) return;
        longPressFired = false;
        clearLongPress();
        longPressTimer = setTimeout(() => {
          longPressFired = true;
          repeatLastSegment(dateKey, d.id);
        }, 520);
      });

      segEl.addEventListener("pointerup", clearLongPress);
      segEl.addEventListener("pointerleave", clearLongPress);
      segEl.addEventListener("pointercancel", clearLongPress);

      segEl.addEventListener("click", (e) => {
        if(longPressFired){
          e.preventDefault();
          longPressFired = false;
          return;
        }
        openSegment(dateKey, d.id);
      });
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

  function renderSupplements(dateKey){
    if(!els.supplementsPanel) return;
    const state = getState();
    const redacted = !!state.settings?.privacy?.redactHome;
    const mode = state.settings?.supplementsMode || "none";
    const enabled = mode && mode !== "none";
    els.supplementsPanel.hidden = !enabled || redacted;
    if(!enabled || redacted) return;

    if(els.supplementsModeLabel){
      const label = (mode === "essential") ? "Essential" : (mode === "advanced" ? "Advanced" : "Off");
      els.supplementsModeLabel.textContent = label;
    }

    const day = getDay(dateKey);
    const supp = day.supplements || { mode, items: [], notes: "", tsLast: "" };
    const selected = new Set(Array.isArray(supp.items) ? supp.items : []);

    if(els.supplementsChips){
      const list = (Array.isArray(state.rosters?.supplements) ? state.rosters.supplements : [])
        .filter((item) => item && !item.archived)
        .slice()
        .sort((a, b) => {
          const pin = (b?.pinned ? 1 : 0) - (a?.pinned ? 1 : 0);
          if(pin !== 0) return pin;
          return String(a?.label || "").localeCompare(String(b?.label || ""));
        });

      if(list.length === 0){
        els.supplementsChips.innerHTML = `<div class="tiny muted">Add supplements in Settings.</div>`;
      }else{
        els.supplementsChips.innerHTML = list.map((item) => {
          const active = selected.has(item.id);
          const pinned = item.pinned ? " pinned" : "";
          return `<button class="chip${active ? " active" : ""}${pinned}" data-id="${escapeHtml(item.id)}" type="button">${escapeHtml(item.label || item.id)}</button>`;
        }).join("");
        els.supplementsChips.querySelectorAll(".chip").forEach((btn) => {
          btn.addEventListener("click", () => {
            const itemId = btn.dataset.id;
            if(!itemId || typeof actions.toggleSupplementItem !== "function") return;
            captureUndo("Supplement toggled", () => actions.toggleSupplementItem(dateKey, itemId));
            renderSupplements(dateKey);
          });
        });
      }
    }

    if(els.supplementsNotes){
      els.supplementsNotes.value = supp.notes || "";
    }
  }

  function applyHomeRedaction(){
    const redacted = !!getState().settings?.privacy?.redactHome;
    if(els.notesBlock) els.notesBlock.hidden = redacted;
    if(els.redactionBanner) els.redactionBanner.hidden = !redacted;
    document.body.classList.toggle("redact-home", redacted);
  }

  function renderToday(){
    const dateKey = yyyyMmDd(getCurrentDate());
    els.datePicker.value = dateKey;

    const day = getDay(dateKey);
    if(!getState().logs[dateKey]){
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
    renderTodayNudge(dateKey);
    wireNotes(dateKey);
    applyHomeRedaction();
  }

  function renderTodayNudge(dateKey){
    if(!els.todayNudge) return;
    const settings = getState().settings || {};
    if(!settings.nudgesEnabled){
      todayNudgeInsight = null;
      els.todayNudge.hidden = true;
      return;
    }

    const insights = computeInsights({
      state: getState(),
      anchorDate: dateFromKey(dateKey),
      includeDay: true,
      includeWeek: false
    }).filter((insight) => insight.scope === "day");

    const pick = insights[0];
    if(!pick){
      todayNudgeInsight = null;
      els.todayNudge.hidden = true;
      return;
    }

    todayNudgeInsight = pick;
    els.todayNudge.hidden = false;
    if(els.todayNudgeTitle) els.todayNudgeTitle.textContent = pick.title || "Insight";
    if(els.todayNudgeMessage) els.todayNudgeMessage.textContent = pick.message || "";
    if(els.todayNudgeReason) els.todayNudgeReason.textContent = pick.reason ? `Reason: ${pick.reason}` : "";
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

  function formatSnapshotTime(ts){
    const d = new Date(ts);
    if(Number.isNaN(d.getTime())) return String(ts || "");
    return d.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function renderSnapshotList(list){
    if(!els.snapshotList) return;
    const items = Array.isArray(list) ? list : [];
    if(items.length === 0){
      els.snapshotList.innerHTML = `<div class="tiny muted">No snapshots yet.</div>`;
      return;
    }

    const sorted = [...items].sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    els.snapshotList.innerHTML = sorted.map((snap) => {
      const label = snap?.label ? String(snap.label) : "Snapshot";
      const ts = snap?.ts ? String(snap.ts) : "";
      const pretty = formatSnapshotTime(ts);
      return `
        <div class="snapshot-item" data-snapshot-id="${escapeHtml(String(snap?.id || ""))}">
          <div class="snapshot-meta">
            <div class="snapshot-label">${escapeHtml(label)}</div>
            <div class="snapshot-time">${escapeHtml(pretty)}</div>
          </div>
          <div class="snapshot-actions">
            <button class="btn small ghost" type="button" data-action="restore">Restore</button>
            <button class="btn small ghost" type="button" data-action="delete">Delete</button>
          </div>
        </div>
      `;
    }).join("");

    els.snapshotList.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".snapshot-item");
        const snapshotId = row?.dataset?.snapshotId;
        if(!snapshotId) return;
        const label = row?.querySelector(".snapshot-label")?.textContent || "Snapshot";
        const time = row?.querySelector(".snapshot-time")?.textContent || "";
        if(btn.dataset.action === "restore"){
          if(!confirm(`Restore snapshot \"${label}\" (${time})? This will replace current data.`)) return;
          try{
            undoState = null;
            await actions.restoreSnapshot(snapshotId);
            renderAll();
            showUndoToast("Snapshot restored");
          }catch(e){
            showUndoToast("Snapshot restore failed");
          }
          return;
        }
        if(btn.dataset.action === "delete"){
          if(!confirm(`Delete snapshot \"${label}\" (${time})? This cannot be undone.`)) return;
          try{
            await actions.deleteSnapshot(snapshotId);
            renderDiagnostics();
            showUndoToast("Snapshot deleted");
          }catch(e){
            showUndoToast("Snapshot delete failed");
          }
        }
      });
    });
  }

  function renderDiagnostics(){
    if(!els.diagStorageMode) return;
    const state = getState();
    const meta = state.meta || {};
    const setValue = (el, value) => {
      if(!el) return;
      el.textContent = value || "—";
    };
    setValue(els.diagStorageMode, meta.storageMode);
    setValue(els.diagPersistStatus, meta.persistStatus);
    setValue(els.diagSchemaVersion, String(meta.version || state.version || ""));
    setValue(els.diagAppVersion, meta.appVersion);
    setValue(els.diagInstallId, meta.installId);
    if(els.diagSnapshotCount || els.snapshotList){
      const requestId = ++diagSnapshotSeq;
      if(els.diagSnapshotCount){
        setValue(els.diagSnapshotCount, "...");
      }
      if(els.snapshotList){
        els.snapshotList.innerHTML = `<div class="tiny muted">Loading…</div>`;
      }
      if(typeof actions.listSnapshots === "function"){
        actions.listSnapshots()
          .then((list) => {
            if(requestId !== diagSnapshotSeq) return;
            const items = Array.isArray(list) ? list : [];
            if(els.diagSnapshotCount){
              setValue(els.diagSnapshotCount, String(items.length));
            }
            renderSnapshotList(items);
          })
          .catch(() => {
            if(requestId !== diagSnapshotSeq) return;
            if(els.diagSnapshotCount){
              setValue(els.diagSnapshotCount, "—");
            }
            renderSnapshotList([]);
          });
      }else{
        if(els.diagSnapshotCount){
          setValue(els.diagSnapshotCount, "—");
        }
        renderSnapshotList([]);
      }
    }
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

    renderDiagnostics();
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
    const summary = computeWeeklySummary({
      logs: state.logs,
      rosters: state.rosters,
      anchorDate: anchor,
      weekStart,
      phase: state.settings.phase || ""
    });
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
        <div class="issue-chip">High‑fat day toggles: ${issues.highFatDayDays}/${totalDays}</div>
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
            <div class="corr-line">${escapeHtml(line)} • Observed in ${entry.total} days</div>
          </div>
        `;
      }).join("");
      els.reviewCorrelations.innerHTML = rows || `<div class="tiny muted">No correlations yet.</div>`;
    }

    if(els.reviewInsights){
      reviewInsights = computeInsights({ state, anchorDate: anchor, includeDay: true, includeWeek: true });
      const dayInsights = reviewInsights.filter((insight) => insight.scope === "day");
      const weekInsights = reviewInsights.filter((insight) => insight.scope === "week");
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
      row.addEventListener("click", (e) => {
        const key = row.dataset.date;
        if(!key) return;
        const target = e.target.closest(".matrix-cell");
        const col = target?.dataset?.col || "";
        setCurrentDate(new Date(key + "T12:00:00"));
        setActiveTab("today");
        renderToday();
        if(col){
          const segId = findSegmentForMatrixCell(getDay(key), col);
          if(segId){
            openSegment(key, segId);
          }
        }
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

  function findSegmentForMatrixCell(day, col){
    const order = ["ftn", "lunch", "dinner", "late"];
    const segments = day?.segments || {};
    const state = getState();

    if(["proteins", "carbs", "fats", "micros"].includes(col)){
      for(const id of order){
        const seg = segments[id];
        if(seg && Array.isArray(seg[col]) && seg[col].length){
          return id;
        }
      }
      return null;
    }

    if(col === "seedOil"){
      for(const id of order){
        const seg = segments[id];
        if(seg?.seedOil === "yes") return id;
      }
      return null;
    }

    if(col === "collision" || col === "highFat"){
      for(const id of order){
        const seg = segments[id];
        if(!seg) continue;
        const effective = effectiveSegmentFlags(seg, state.rosters);
        if(col === "collision" && effective.collision.value) return id;
        if(col === "highFat" && effective.highFatMeal.value) return id;
      }
      return null;
    }

    return null;
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
    if(els.setWeekStart){
      const weekStart = Number.isFinite(s.weekStart) ? s.weekStart : 0;
      els.setWeekStart.value = String(weekStart);
    }
    if(els.setSupplementsMode){
      els.setSupplementsMode.value = s.supplementsMode || "none";
    }

    const autoSun = (s.sunMode === "auto");
    els.setSunrise.disabled = autoSun;
    els.setSunset.disabled = autoSun;
    if(els.sunAutoBtn){
      els.sunAutoBtn.disabled = !(navigator && navigator.geolocation);
    }
    if(autoSun){
      if(Number.isFinite(s.lastKnownLat) && Number.isFinite(s.lastKnownLon)){
        setSunAutoStatus(`Auto active • ${formatLatLon(s.lastKnownLat, s.lastKnownLon)}`);
      }else{
        setSunAutoStatus("Auto active • tap Update from location");
      }
    }else{
      setSunAutoStatus("Auto off • tap Update from location to enable");
    }

    if(els.privacyBlurToggle){
      els.privacyBlurToggle.checked = !!(s.privacy && s.privacy.blurOnBackground);
    }
    if(els.privacyAppLockToggle){
      els.privacyAppLockToggle.checked = !!(s.privacy && s.privacy.appLock);
    }
    if(els.appLockSetBtn){
      els.appLockSetBtn.disabled = !canUseCrypto();
      const hasPasscode = hasAppLockSecret();
      els.appLockSetBtn.textContent = hasPasscode ? "Change passcode" : "Set passcode";
    }
    if(els.privacyRedactToggle){
      els.privacyRedactToggle.checked = !!(s.privacy && s.privacy.redactHome);
    }
    if(els.privacyEncryptedToggle){
      els.privacyEncryptedToggle.checked = !!(s.privacy && s.privacy.exportEncryptedByDefault);
    }
    if(els.todayNudgeToggle){
      els.todayNudgeToggle.checked = !!s.nudgesEnabled;
    }
    refreshPrivacyBlur();

    renderRosterList("proteins", els.rosterProteins);
    renderRosterList("carbs", els.rosterCarbs);
    renderRosterList("fats", els.rosterFats);
    renderRosterList("micros", els.rosterMicros);
    if(els.rosterSupplements){
      const enabled = !!(s.supplementsMode && s.supplementsMode !== "none");
      if(els.rosterSupplementsBlock){
        els.rosterSupplementsBlock.hidden = !enabled;
      }
      if(enabled){
        renderRosterList("supplements", els.rosterSupplements);
      }else{
        els.rosterSupplements.innerHTML = "";
      }
    }
  }

  function renderAll(){
    renderToday();
    renderHistory();
    renderReview();
    renderSettings();
    applyAppLock();
  }

  function wire(){
    // tabs
    els.tabToday.addEventListener("click", () => { setActiveTab("today"); renderToday(); });
    els.tabHistory.addEventListener("click", () => { setActiveTab("history"); renderHistory(); });
    els.tabReview.addEventListener("click", () => { setActiveTab("review"); renderReview(); });
    els.tabSettings.addEventListener("click", () => { setActiveTab("settings"); renderSettings(); });

    if(els.appLockSubmit){
      els.appLockSubmit.addEventListener("click", () => {
        attemptUnlock();
      });
    }
    if(els.appLockInput){
      els.appLockInput.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){
          e.preventDefault();
          attemptUnlock();
        }
      });
    }

    if(els.reviewInsights){
      els.reviewInsights.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action='dismiss-insight']");
        if(!btn) return;
        if(typeof actions.dismissInsight !== "function") return;
        const insightId = btn.dataset.insightId || "";
        if(!insightId) return;
        const insight = reviewInsights.find((item) => item.id === insightId);
        if(!insight) return;
        actions.dismissInsight(insight);
        renderReview();
      });
    }

    // date nav
    els.prevDay.addEventListener("click", () => { setCurrentDate(addDays(getCurrentDate(), -1)); renderToday(); });
    els.nextDay.addEventListener("click", () => { setCurrentDate(addDays(getCurrentDate(), 1)); renderToday(); });
    els.datePicker.addEventListener("change", () => {
      if(els.datePicker.value){
        setCurrentDate(new Date(els.datePicker.value + "T12:00:00"));
        renderToday();
      }
    });
    if(els.copyYesterday){
      els.copyYesterday.addEventListener("click", copyYesterdayIntoToday);
    }
    if(els.todayNudgeDismiss){
      els.todayNudgeDismiss.addEventListener("click", () => {
        if(!todayNudgeInsight) return;
        actions.dismissInsight?.(todayNudgeInsight);
        todayNudgeInsight = null;
        renderToday();
      });
    }

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

    if(els.supplementsNotes){
      els.supplementsNotes.addEventListener("input", () => {
        const dateKey = yyyyMmDd(getCurrentDate());
        clearTimeout(supplementsNotesDebounce);
        supplementsNotesDebounce = setTimeout(() => {
          if(typeof actions.setSupplementsNotes !== "function") return;
          captureUndo("Supplements notes updated", () => actions.setSupplementsNotes(dateKey, els.supplementsNotes.value || ""));
        }, 320);
      });
    }

    // history export/import
    if(els.exportBtn){
      els.exportBtn.addEventListener("click", (e) => {
        const mode = e.currentTarget?.dataset?.mode || "";
        actions.exportState(mode || undefined);
      });
    }
    if(els.exportAltBtn){
      els.exportAltBtn.addEventListener("click", (e) => {
        const mode = e.currentTarget?.dataset?.mode || "";
        actions.exportState(mode || undefined);
      });
    }
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

    if(els.snapshotCreate){
      els.snapshotCreate.addEventListener("click", async () => {
        if(typeof actions.createSnapshot !== "function") return;
        try{
          undoState = null;
          await actions.createSnapshot("Manual snapshot");
          renderDiagnostics();
          showUndoToast("Snapshot saved");
        }catch(e){
          showUndoToast("Snapshot failed");
        }
      });
    }

    if(els.appLockSetBtn){
      els.appLockSetBtn.addEventListener("click", async () => {
        if(!canUseCrypto()){
          alert("App lock requires WebCrypto.");
          return;
        }
        const enabled = isAppLockEnabled() || !!els.privacyAppLockToggle?.checked;
        if(enabled && hasAppLockSecret()){
          const ok = await verifyExistingPasscode("Enter current passcode:");
          if(!ok) return;
        }
        const ok = await ensureAppLockPasscode();
        if(!ok) return;
        if(els.privacyAppLockToggle && !els.privacyAppLockToggle.checked){
          els.privacyAppLockToggle.checked = true;
        }
        if(!isAppLockEnabled()){
          captureUndo("App lock enabled", () => actions.updateSettings({ privacy: { appLock: true } }));
          appLocked = false;
          refreshAppLock();
        }
        showUndoToast(enabled ? "Passcode changed" : "Passcode set");
      });
    }

    // settings save/reset
    els.saveSettings.addEventListener("click", async () => {
      const parsedWeekStart = Number.parseInt(els.setWeekStart?.value || "", 10);
      const existingPrivacy = getState().settings?.privacy || {};
      let nextAppLock = !!els.privacyAppLockToggle?.checked;
      const wasAppLock = !!existingPrivacy.appLock;
      const hasPasscode = hasAppLockSecret();
      const blurOnBackground = !!els.privacyBlurToggle?.checked;
      const redactHome = !!els.privacyRedactToggle?.checked;
      const exportEncryptedByDefault = !!els.privacyEncryptedToggle?.checked;
      const nudgesEnabled = !!els.todayNudgeToggle?.checked;

      if(nextAppLock && !hasPasscode){
        const ok = await ensureAppLockPasscode();
        if(!ok){
          nextAppLock = false;
          if(els.privacyAppLockToggle) els.privacyAppLockToggle.checked = false;
        }
      }else if(!nextAppLock && wasAppLock){
        if(hasPasscode){
          const ok = await verifyExistingPasscode("Enter passcode to disable app lock:");
          if(!ok){
            nextAppLock = true;
            if(els.privacyAppLockToggle) els.privacyAppLockToggle.checked = true;
          }else{
            clearAppLockRecord();
            appLocked = false;
          }
        }else{
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
      if(autoSun){
        setSunAutoStatus("Auto active • tap Update from location");
      }else{
        setSunAutoStatus("Auto off • tap Update from location to enable");
      }
    });

    if(els.sunAutoBtn){
      els.sunAutoBtn.addEventListener("click", updateSunTimesFromLocation);
    }

    if(els.privacyBlurToggle){
      els.privacyBlurToggle.addEventListener("change", () => {
        const enabled = !!els.privacyBlurToggle.checked;
        captureUndo("Privacy blur updated", () => actions.updateSettings({ privacy: { blurOnBackground: enabled } }));
        refreshPrivacyBlur();
      });
    }

    if(els.privacyRedactToggle){
      els.privacyRedactToggle.addEventListener("change", () => {
        const enabled = !!els.privacyRedactToggle.checked;
        captureUndo("Home redaction updated", () => actions.updateSettings({ privacy: { redactHome: enabled } }));
        renderToday();
      });
    }

    document.addEventListener("visibilitychange", () => {
      refreshPrivacyBlur();
      if(isAppLockEnabled() && document.hidden){
        appLocked = true;
      }
      refreshAppLock();
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
          renderSettings();
          renderCategoryChips(category);
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

    wireChipContainer(els.chipsProteins, "proteins");
    wireChipContainer(els.chipsCarbs, "carbs");
    wireChipContainer(els.chipsFats, "fats");
    wireChipContainer(els.chipsMicros, "micros");

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
    appLocked = isAppLockEnabled() && hasAppLockSecret();
    setActiveTab("today");
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
