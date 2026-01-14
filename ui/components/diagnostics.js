// @ts-check

import { renderSnapshotList as renderSnapshotListComponent } from "./snapshot_list.js";
import { renderAuditLog as renderAuditLogComponent } from "./audit_log.js";
import { collectMissingRosterItems } from "../legacy_helpers.js";

export function renderDiagnosticsPanel({
  els,
  state,
  actions,
  parseTimeToMinutes,
  clampLocalTime,
  formatSnapshotTime,
  escapeHtml,
  diagState,
  onRestoreSnapshot,
  onDeleteSnapshot
}){
  if(!els.diagStorageMode) return { missingRosterItems: new Map() };
  const meta = state.meta || {};
  const setValue = (el, value) => {
    if(!el) return;
    el.textContent = value || "—";
  };

  setValue(els.diagStorageMode, meta.storageMode);
  setValue(els.diagPersistStatus, meta.persistStatus);
  const syncMeta = meta.sync || {};
  const syncMode = state.settings?.sync?.mode === "off" ? "paused" : "hosted";
  if(els.diagSyncStatus){
    let label = "—";
    if(syncMode === "paused"){
      label = "Paused";
    }else if(syncMeta.status === "syncing"){
      label = "Syncing";
    }else if(syncMeta.status === "idle" || syncMeta.status === ""){
      label = "Idle";
    }else if(syncMeta.status === "error"){
      label = "Error";
    }else if(syncMeta.status === "offline"){
      label = "Offline";
    }
    setValue(els.diagSyncStatus, label);
  }
  if(els.diagOutboxDepth){
    const pending = Number.isFinite(syncMeta.pendingOutbox) ? String(syncMeta.pendingOutbox) : "0";
    setValue(els.diagOutboxDepth, pending);
  }
  if(els.diagConflictCount){
    const conflicts = Number.isFinite(syncMeta.conflicts) ? String(syncMeta.conflicts) : "0";
    setValue(els.diagConflictCount, conflicts);
  }
  if(els.diagLastError){
    setValue(els.diagLastError, syncMeta.lastError);
  }
  if(els.diagSafeMode){
    const safeMode = meta?.integrity?.safeMode ? "ON" : "OFF";
    setValue(els.diagSafeMode, safeMode);
  }
  if(els.safeModeBanner){
    const active = !!meta?.integrity?.safeMode;
    els.safeModeBanner.classList.toggle("hidden", !active);
  }
  setValue(els.diagSchemaVersion, String(meta.version || state.version || ""));
  setValue(els.diagAppVersion, meta.appVersion);
  setValue(els.diagInstallId, meta.installId);

  if(els.diagDstClamp){
    const dst = meta?.integrity?.dstClamp;
    let clampLabel = "";
    if(dst && (dst.applied || dst.ambiguous)){
      const reason = dst.ambiguous ? "ambiguous time" : "gap";
      clampLabel = `DST clamp applied (${reason})`;
    }else if(!dst){
      const settings = state.settings || {};
      const now = new Date();
      const boundaryKeys = ["dayStart", "dayEnd", "ftnEnd", "lunchEnd", "dinnerEnd"];
      for(const key of boundaryKeys){
        const minutes = parseTimeToMinutes(settings[key]);
        const clamp = clampLocalTime(now, minutes);
        if(clamp.clamped || clamp.reason === "ambiguous"){
          const reason = clamp.reason === "ambiguous" ? "ambiguous time" : "gap";
          clampLabel = `DST clamp applied (${reason})`;
          break;
        }
      }
    }
    setValue(els.diagDstClamp, clampLabel);
  }

  if(els.diagSnapshotCount || els.snapshotList){
    const requestId = ++diagState.snapshotSeq;
    if(els.diagSnapshotCount){
      setValue(els.diagSnapshotCount, "...");
    }
    if(els.snapshotList){
      els.snapshotList.innerHTML = `<div class="tiny muted">Loading…</div>`;
    }
    if(typeof actions.listSnapshots === "function"){
      actions.listSnapshots()
        .then((list) => {
          if(requestId !== diagState.snapshotSeq) return;
          const items = Array.isArray(list) ? list : [];
          if(els.diagSnapshotCount){
            setValue(els.diagSnapshotCount, String(items.length));
          }
          renderSnapshotListComponent({
            container: els.snapshotList,
            list: items,
            formatSnapshotTime,
            escapeHtml,
            onRestore: onRestoreSnapshot,
            onDelete: onDeleteSnapshot
          });
        })
        .catch(() => {
          if(requestId !== diagState.snapshotSeq) return;
          if(els.diagSnapshotCount){
            setValue(els.diagSnapshotCount, "—");
          }
          renderSnapshotListComponent({
            container: els.snapshotList,
            list: [],
            formatSnapshotTime,
            escapeHtml,
            onRestore: null,
            onDelete: null
          });
        });
    }else{
      if(els.diagSnapshotCount){
        setValue(els.diagSnapshotCount, "—");
      }
      renderSnapshotListComponent({
        container: els.snapshotList,
        list: [],
        formatSnapshotTime,
        escapeHtml,
        onRestore: null,
        onDelete: null
      });
    }
  }

  if(els.auditLogList){
    const requestId = ++diagState.auditSeq;
    els.auditLogList.innerHTML = `<div class="tiny muted">Loading…</div>`;
    if(typeof actions.listAuditLog === "function"){
      actions.listAuditLog()
        .then((list) => {
          if(requestId !== diagState.auditSeq) return;
          diagState.auditLogCache = Array.isArray(list) ? list : [];
          renderAuditLogComponent({
            container: els.auditLogList,
            list: diagState.auditLogCache,
            filter: els.auditFilter ? els.auditFilter.value : "all",
            formatSnapshotTime,
            escapeHtml
          });
        })
        .catch(() => {
          if(requestId !== diagState.auditSeq) return;
          diagState.auditLogCache = [];
          renderAuditLogComponent({
            container: els.auditLogList,
            list: [],
            filter: els.auditFilter ? els.auditFilter.value : "all",
            formatSnapshotTime,
            escapeHtml
          });
        });
    }else{
      diagState.auditLogCache = [];
      renderAuditLogComponent({
        container: els.auditLogList,
        list: [],
        filter: els.auditFilter ? els.auditFilter.value : "all",
        formatSnapshotTime,
        escapeHtml
      });
    }
  }

  const missingRosterItems = collectMissingRosterItems(state.rosters, state.logs);
  if(els.diagMissingItems){
    setValue(els.diagMissingItems, String(missingRosterItems.size));
    els.diagMissingItems.title = missingRosterItems.size ? "Click to repair missing roster IDs" : "";
  }

  return { missingRosterItems };
}
