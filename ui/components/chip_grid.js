// @ts-check

import { searchRosterItems } from "../../domain/search.js";

export function renderChipSet(container, roster, selected, query, escapeHtml, options = {}){
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

  const rosterIds = new Set(rosterItems.map((item) => item.id || item.label));
  for(const id of selSet){
    if(!id || rosterIds.has(id)) continue;
    rosterItems.push({
      id,
      label: "[Missing Item]",
      pinned: false,
      archived: false,
      aliases: [],
      missing: true
    });
    rosterIds.add(id);
  }

  const rosterMap = new Map(rosterItems.map((item) => [item.id || item.label, item]));
  const renderChip = (item) => {
    const id = item.id || item.label || "";
    const label = item.label || id;
    const on = selSet.has(id);
    const pin = item.pinned ? " pinned" : "";
    const missing = item.missing ? " missing" : "";
    return `<button type="button" class="chip ${on ? "active" : ""}${pin}${missing}" data-item="${escapeHtml(id)}" data-missing="${item.missing ? "1" : "0"}">${escapeHtml(label)}</button>`;
  };

  if(normalized){
    const list = searchRosterItems(rosterItems, normalized, { includeArchived: false, limit: 60 });
    const chips = list.map(renderChip);
    if(list.length === 0){
      chips.push(`<button type="button" class="chip add" data-add="1" data-label="${escapeHtml(normalized)}">+ Add ${escapeHtml(normalized)}</button>`);
    }
    container.innerHTML = chips.join("");
    return;
  }

  if(options.sectioned){
    const recents = Array.isArray(options.recents) ? options.recents : [];
    const selectedItems = selected
      .map((id) => rosterMap.get(id))
      .filter(Boolean);
    const pinnedItems = rosterItems.filter((item) => item.pinned && !selSet.has(item.id || item.label));
    const recentItems = recents
      .map((id) => rosterMap.get(id))
      .filter((item) => item && !selSet.has(item.id || item.label) && !item.pinned);
    const recentSet = new Set(recentItems.map((item) => item.id || item.label));
    const remainingItems = rosterItems
      .filter((item) => {
        const id = item.id || item.label;
        return !selSet.has(id) && !item.pinned && !recentSet.has(id);
      })
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));

    const renderSection = (label, items) => {
      if(!items.length) return "";
      return `
        <div class="chip-section">
          <div class="chip-section-title">${escapeHtml(label)}</div>
          <div class="chip-grid">${items.map(renderChip).join("")}</div>
        </div>
      `;
    };

    const sections = [
      renderSection("Selected", selectedItems),
      renderSection("Pinned", pinnedItems),
      renderSection("Recents", recentItems),
      renderSection("All", remainingItems)
    ].filter(Boolean);

    container.innerHTML = sections.join("") || renderSection("All", rosterItems);
    return;
  }

  const list = rosterItems.slice().sort((a, b) => {
    const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if(pin !== 0) return pin;
    return String(a.label || "").localeCompare(String(b.label || ""));
  });

  container.innerHTML = list.map(renderChip).join("");
}
