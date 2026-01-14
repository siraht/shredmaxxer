// @ts-check

import { searchRosterItems } from "../../domain/search.js";

export function renderChipSet(container, roster, selected, query, escapeHtml){
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

  const list = normalized
    ? searchRosterItems(rosterItems, normalized, { includeArchived: false, limit: 60 })
    : rosterItems.slice().sort((a, b) => {
      const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if(pin !== 0) return pin;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });

  const chips = list.map((item) => {
    const id = item.id || item.label || "";
    const label = item.label || id;
    const on = selSet.has(id);
    const pin = item.pinned ? " pinned" : "";
    const missing = item.missing ? " missing" : "";
    return `<button type="button" class="chip ${on ? "active" : ""}${pin}${missing}" data-item="${escapeHtml(id)}" data-missing="${item.missing ? "1" : "0"}">${escapeHtml(label)}</button>`;
  });

  if(normalized && list.length === 0){
    chips.push(`<button type="button" class="chip add" data-add="1" data-label="${escapeHtml(normalized)}">+ Add ${escapeHtml(normalized)}</button>`);
  }

  container.innerHTML = chips.join("");
}
