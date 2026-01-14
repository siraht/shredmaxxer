// @ts-check

export function renderSupplements({
  els,
  state,
  dateKey,
  day,
  escapeHtml,
  onToggle
}){
  if(!els.supplementsPanel) return;
  const redacted = !!state.settings?.privacy?.redactHome;
  const mode = state.settings?.supplementsMode || "none";
  const enabled = mode && mode !== "none";
  els.supplementsPanel.hidden = !enabled || redacted;
  if(!enabled || redacted) return;

  if(els.supplementsModeLabel){
    const label = (mode === "essential")
      ? "Essential"
      : (mode === "advanced" ? "Advanced" : "Off");
    els.supplementsModeLabel.textContent = label;
  }

  const supp = day.supplements || { mode, items: [], notes: "", tsLast: "" };
  const selected = new Set(Array.isArray(supp.items) ? supp.items : []);

  if(els.supplementsChips){
    const list = (Array.isArray(state.rosters?.supplements) ? state.rosters.supplements : [])
      .map((item) => {
        if(typeof item === "string"){
          return { id: item, label: item, pinned: false, archived: false, aliases: [] };
        }
        return item;
      })
      .filter((item) => item && !item.archived)
      .slice()
      .sort((a, b) => {
        const pin = (b?.pinned ? 1 : 0) - (a?.pinned ? 1 : 0);
        if(pin !== 0) return pin;
        return String(a?.label || "").localeCompare(String(b?.label || ""));
      });
    const rosterIds = new Set(list.map((item) => item?.id || item?.label));
    for(const id of selected){
      if(!id || rosterIds.has(id)) continue;
      list.push({ id, label: "[Missing Item]", pinned: false, archived: false, missing: true });
      rosterIds.add(id);
    }

    if(list.length === 0){
      els.supplementsChips.innerHTML = `<div class="tiny muted">Add supplements in Settings.</div>`;
    }else{
      els.supplementsChips.innerHTML = list.map((item) => {
        const active = selected.has(item.id);
        const pinned = item.pinned ? " pinned" : "";
        const missing = item.missing ? " missing" : "";
        return `<button class="chip${active ? " active" : ""}${pinned}${missing}" data-id="${escapeHtml(item.id)}" data-missing="${item.missing ? "1" : "0"}" type="button">${escapeHtml(item.label || item.id)}</button>`;
      }).join("");
      els.supplementsChips.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          const itemId = btn.dataset.id;
          if(!itemId) return;
          if(typeof onToggle === "function"){
            onToggle(itemId, dateKey);
          }
        });
      });
    }
  }

  if(els.supplementsNotes){
    els.supplementsNotes.value = supp.notes || "";
  }
}
