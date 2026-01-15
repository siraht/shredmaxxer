// @ts-check

export function renderTimeline({
  els,
  dateKey,
  state,
  segmentDefs,
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
}) {
  const start = segmentDefs[0].start;
  const end = segmentDefs[segmentDefs.length - 1].end;
  const span = Math.max(1, end - start);

  els.timelineTrack.innerHTML = "";
  segmentElsRef.current = {};

  for (const d of segmentDefs) {
    const leftPct = ((d.start - start) / span) * 100;
    const widthPct = ((d.end - d.start) / span) * 100;

    const segEl = document.createElement("div");
    segEl.className = "segment";
    segEl.style.left = `${leftPct}%`;
    segEl.style.width = `${widthPct}%`;
    segEl.setAttribute("role", "button");
    segEl.setAttribute("tabindex", "0");
    segEl.dataset.segment = d.id;

    const title = document.createElement("div");
    title.className = "segment-title";
    title.textContent = d.label;

    const kicker = document.createElement("div");
    kicker.className = "segment-kicker";
    kicker.textContent = "WINDOW";

    const time = document.createElement("div");
    time.className = "segment-time";
    time.textContent = formatRange(d.start, d.end);

    const flags = document.createElement("div");
    flags.className = "seg-flags";
    flags.innerHTML = "";

    const bubbles = document.createElement("div");
    bubbles.className = "bubbles";
    bubbles.innerHTML = `
      <div class="bubble" data-b="P">P<span class="count" data-c="P"></span></div>
      <div class="bubble" data-b="C">C<span class="count" data-c="C"></span></div>
      <div class="bubble" data-b="F">F<span class="count" data-c="F"></span></div>
      <div class="bubble" data-b="M">μ<span class="count" data-c="M"></span></div>
    `;

    segEl.appendChild(kicker);
    segEl.appendChild(title);
    segEl.appendChild(time);
    segEl.appendChild(flags);
    segEl.appendChild(bubbles);

    let longPressTimer = null;
    let longPressFired = false;

    const clearLongPress = () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = null;
    };

    segEl.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
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
      if (longPressFired) {
        e.preventDefault();
        longPressFired = false;
        return;
      }
      openSegment(dateKey, d.id);
    });
    segEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openSegment(dateKey, d.id);
      }
    });

    els.timelineTrack.appendChild(segEl);
    segmentElsRef.current[d.id] = segEl;

    updateSegmentVisual(dateKey, d.id);
  }

  if (dateKey === getActiveDateKey()) {
    const now = nowMinutes();
    const nowLifted = liftMinuteToTimeline(now, start);
    const cur = whichSegment(nowLifted, segmentDefs);
    for (const d of segmentDefs) {
      segmentElsRef.current[d.id]?.setAttribute("aria-current", d.id === cur ? "true" : "false");
    }
  } else {
    for (const d of segmentDefs) {
      segmentElsRef.current[d.id]?.setAttribute("aria-current", "false");
    }
  }

  renderSolarArc({
    els,
    dateKey,
    state,
    segmentDefs,
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
  applyFutureFog({
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

export function applyFutureFog({
  els,
  dateKey,
  state,
  start,
  end,
  nowMinutes,
  liftMinuteToTimeline,
  getActiveDateKey
}) {
  const mode = state.settings.focusMode || "nowfade";
  els.focusLabel.textContent = (mode === "full") ? "Full day" : "Fade future";

  if (mode !== "nowfade" || dateKey !== getActiveDateKey()) {
    els.futureFog.classList.remove("on");
    return;
  }

  const now = nowMinutes();
  const nowLifted = liftMinuteToTimeline(now, start);
  if (nowLifted < start || nowLifted > end) {
    els.futureFog.classList.remove("on");
    return;
  }
  els.futureFog.classList.add("on");
}

export function renderSolarArc({
  els,
  dateKey,
  state,
  segmentDefs,
  start,
  end,
  nowMinutes,
  liftMinuteToTimeline,
  clamp,
  parseTimeToMinutes,
  clampLocalTime,
  dateFromKey,
  minutesToTime,
  getActiveDateKey,
  fmtTime,
  whichSegment,
  segmentElsRef
}) {
  const span = Math.max(1, end - start);

  const date = dateFromKey(dateKey);
  const sunriseClamp = clampLocalTime(date, parseTimeToMinutes(state.settings.sunrise));
  const sunsetClamp = clampLocalTime(date, parseTimeToMinutes(state.settings.sunset));
  const sunriseMin = sunriseClamp.minutes;
  const sunsetMin = sunsetClamp.minutes;
  const wraps = end > 1440;
  const sunriseOnTimeline = wraps ? liftMinuteToTimeline(sunriseMin, start) : sunriseMin;
  const sunsetOnTimeline = wraps ? liftMinuteToTimeline(sunsetMin, start) : sunsetMin;
  const sunriseClamped = clamp(sunriseOnTimeline, start, end);
  const sunsetClamped = clamp(sunsetOnTimeline, start, end);

  const W = 1000;
  const yBase = 210;
  const yPeak = 50;

  const xSunrise = ((sunriseClamped - start) / span) * W;
  const xSunset = ((sunsetClamped - start) / span) * W;

  const path = computeArcPath(xSunrise, xSunset, yBase, yPeak);
  els.sunArc.setAttribute("d", path);

  const isToday = (dateKey === getActiveDateKey());
  const tMin = isToday ? nowMinutes() : (start + Math.floor(span * 0.45));
  const tMinLocal = ((tMin % 1440) + 1440) % 1440;
  const tMinLifted = liftMinuteToTimeline(tMinLocal, start);

  setSkyByTime({ els, minuteNow: tMinLocal, sunriseMin, sunsetMin, settings: state.settings, fmtTime });

  let sunX = xSunrise;
  let sunY = yBase;
  let showSun = false;

  if (sunsetClamped > sunriseClamped && tMinLifted >= sunriseClamped && tMinLifted <= sunsetClamped) {
    const t = clamp((tMinLifted - sunriseClamped) / (sunsetClamped - sunriseClamped), 0, 1);
    const p = cubicPoint(xSunrise, xSunset, yBase, yPeak, t);
    sunX = p.x;
    sunY = p.y;
    showSun = true;
  } else {
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

  renderNowMarker({
    els,
    dateKey,
    segmentDefs,
    start,
    end,
    nowMinutes,
    liftMinuteToTimeline,
    getActiveDateKey,
    whichSegment,
    segmentElsRef
  });
}

export function renderNowMarker({
  els,
  dateKey,
  segmentDefs,
  start,
  end,
  nowMinutes,
  liftMinuteToTimeline,
  getActiveDateKey,
  whichSegment,
  segmentElsRef
}) {
  if (dateKey !== getActiveDateKey()) {
    els.nowMarker.style.display = "none";
    return;
  }

  const span = Math.max(1, end - start);
  const now = nowMinutes();
  const nowLifted = liftMinuteToTimeline(now, start);
  const pct = clampValue((nowLifted - start) / span, 0, 1) * 100;

  els.nowMarker.style.display = "block";
  els.nowMarker.style.left = `${pct}%`;

  const cur = whichSegment(nowLifted, segmentDefs);
  for (const d of segmentDefs) {
    segmentElsRef.current[d.id]?.setAttribute("aria-current", d.id === cur ? "true" : "false");
  }
}

function setSkyByTime({ els, minuteNow, sunriseMin, sunsetMin, settings, fmtTime }) {
  const dawnStart = sunriseMin - 60;
  const dawnEnd = sunriseMin + 60;
  const duskStart = sunsetMin - 60;
  const duskEnd = sunsetMin + 60;

  let phase = "Night";
  let skyA = "#050714";
  let skyB = "#090b22";
  let skyC = "#0d1238";
  let accent = "var(--sun)";
  let sub = "";

  if (minuteNow >= dawnStart && minuteNow < dawnEnd) {
    phase = "Dawn";
    skyA = "#0a0a25";
    skyB = "#23104b";
    skyC = "#401636";
    accent = "var(--sunrise)";
    sub = `Sunrise ${fmtTime(settings.sunrise)}`;
  } else if (minuteNow >= dawnEnd && minuteNow < duskStart) {
    phase = "Day";
    skyA = "#061026";
    skyB = "#081a34";
    skyC = "#0b1230";
    accent = "var(--sun)";
    sub = `Sunset ${fmtTime(settings.sunset)}`;
  } else if (minuteNow >= duskStart && minuteNow < duskEnd) {
    phase = "Dusk";
    skyA = "#150a1b";
    skyB = "#2a0718";
    skyC = "#0a0a25";
    accent = "var(--sunset)";
    sub = `Sunset ${fmtTime(settings.sunset)}`;
  } else {
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

  if (els.phaseLabel) els.phaseLabel.textContent = phase;
  if (els.phaseSub) els.phaseSub.textContent = sub;

  const focusDot = els.toggleFocus?.querySelector?.(".focus-dot");
  if (focusDot) {
    focusDot.style.background = accent;
  }
}

function computeArcPath(x1, x2, yBase, yPeak) {
  const cp1x = x1 + (x2 - x1) * 0.25;
  const cp2x = x2 - (x2 - x1) * 0.25;
  return `M ${x1.toFixed(2)} ${yBase.toFixed(2)} C ${cp1x.toFixed(2)} ${yPeak.toFixed(2)} ${cp2x.toFixed(2)} ${yPeak.toFixed(2)} ${x2.toFixed(2)} ${yBase.toFixed(2)}`;
}

function cubicPoint(x1, x2, yBase, yPeak, t) {
  const cp1x = x1 + (x2 - x1) * 0.25;
  const cp2x = x2 - (x2 - x1) * 0.25;

  const x = Math.pow(1 - t, 3) * x1 +
    3 * Math.pow(1 - t, 2) * t * cp1x +
    3 * (1 - t) * Math.pow(t, 2) * cp2x +
    Math.pow(t, 3) * x2;

  const y = Math.pow(1 - t, 3) * yBase +
    3 * Math.pow(1 - t, 2) * t * yPeak +
    3 * (1 - t) * Math.pow(t, 2) * yPeak +
    Math.pow(t, 3) * yBase;

  return { x, y };
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
