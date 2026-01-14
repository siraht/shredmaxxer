// @ts-check

export function renderAuditLog({
  container,
  list,
  filter,
  formatSnapshotTime,
  escapeHtml
}){
  if(!container) return;
  const items = Array.isArray(list) ? list : [];
  const mode = filter || "all";
  const filtered = items.filter((entry) => {
    if(!entry || typeof entry !== "object") return false;
    if(mode === "all") return true;
    return entry.level === mode;
  }).sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));

  if(filtered.length === 0){
    container.innerHTML = `<div class="tiny muted">No audit events yet.</div>`;
    return;
  }

  const rows = filtered.slice(0, 20).map((entry) => {
    const level = String(entry.level || "info").toUpperCase();
    const type = String(entry.type || "event");
    const title = `${level} • ${type}`;
    const time = entry.ts ? formatSnapshotTime(String(entry.ts)) : "";
    const message = entry.message ? String(entry.message) : "";
    return `
      <div class="snapshot-item audit-item">
        <div class="snapshot-meta">
          <div class="snapshot-label">${escapeHtml(title)}</div>
          <div class="snapshot-time">${escapeHtml(time)}</div>
          ${message ? `<div class="audit-message">${escapeHtml(message)}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
  container.innerHTML = rows;
}
