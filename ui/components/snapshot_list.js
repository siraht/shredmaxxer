// @ts-check

export function renderSnapshotList({
  container,
  list,
  formatSnapshotTime,
  escapeHtml,
  onRestore,
  onDelete
}){
  if(!container) return;
  const items = Array.isArray(list) ? list : [];
  if(items.length === 0){
    container.innerHTML = `<div class="tiny muted">No snapshots yet.</div>`;
    return;
  }

  const sorted = [...items].sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  container.innerHTML = sorted.map((snap) => {
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

  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".snapshot-item");
      const snapshotId = row?.dataset?.snapshotId;
      if(!snapshotId) return;
      const label = row?.querySelector(".snapshot-label")?.textContent || "Snapshot";
      const time = row?.querySelector(".snapshot-time")?.textContent || "";
      if(btn.dataset.action === "restore"){
        if(!confirm(`Restore snapshot \"${label}\" (${time})? This will replace current data.`)) return;
        if(typeof onRestore === "function"){
          await onRestore(snapshotId);
        }
        return;
      }
      if(btn.dataset.action === "delete"){
        if(!confirm(`Delete snapshot \"${label}\" (${time})? This cannot be undone.`)) return;
        if(typeof onDelete === "function"){
          await onDelete(snapshotId);
        }
      }
    });
  });
}
