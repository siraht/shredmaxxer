// @ts-check

export function renderRosterList(category, container, roster, escapeHtml){
  if(!container) return;
  const items = (Array.isArray(roster) ? roster : [])
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

  container.innerHTML = sorted.map((item) => {
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
