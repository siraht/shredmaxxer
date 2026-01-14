// @ts-check

export function renderSettingsScreen({
  els,
  state,
  setSunAutoStatus,
  formatLatLon,
  refreshPrivacyBlur,
  renderRosterList,
  canUseCrypto,
  hasAppLockSecret
}){
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
  if(els.syncE2eeToggle){
    const enc = s.sync?.encryption === "e2ee" ? "e2ee" : "none";
    els.syncE2eeToggle.value = enc;
  }
  if(els.syncMode){
    const mode = s.sync?.mode === "off" ? "off" : "hosted";
    els.syncMode.value = mode;
  }
  if(els.syncEndpoint){
    const endpoint = s.sync?.endpoint || "";
    els.syncEndpoint.value = endpoint && endpoint !== "/api/sync/v1" ? endpoint : "";
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
