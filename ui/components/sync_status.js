// @ts-check

import { formatSnapshotTime } from "../legacy_helpers.js";

/**
 * @param {{ els: any, sync: any, mode: string }} opts
 */
export function renderSyncStatus({ els, sync, mode }) {
  if (!els.syncStatus) return;
  const info = sync || {};
  let label = "Offline";
  if (mode === "off") label = "Paused";
  else if (info.status === "syncing") label = "Syncing";
  else if (info.status === "idle" || info.status === "") label = "Idle";
  else if (info.status === "error") label = "Error";
  else if (info.status === "offline") label = "Offline";

  const pending = Number.isFinite(info.pendingOutbox) ? info.pendingOutbox : 0;
  els.syncStatus.textContent = pending > 0 ? `${label} • ${pending}` : label;

  if (els.outboxBadge) {
    // [SB-31] Badge strictly reflects outbox length to avoid "ghost" numbers
    const shouldShow = (pending > 0);
    els.outboxBadge.hidden = !shouldShow;
    els.outboxBadge.textContent = shouldShow ? String(pending) : "";
  }

  if (info.lastSyncTs) {
    els.syncStatus.title = `Last sync: ${formatSnapshotTime(info.lastSyncTs)}`;
  } else {
    els.syncStatus.title = "";
  }
}
