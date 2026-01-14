// @ts-check

export function renderScales({
  els,
  dateKey,
  getDay,
  setDay,
  getCurrentDate,
  yyyyMmDd,
  captureUndo,
  rerender
}){
  const day = getDay(dateKey);
  buildScale(els.energyScale, "energy", day.energy);
  buildScale(els.moodScale, "mood", day.mood);
  buildScale(els.cravingsScale, "cravings", day.cravings);

  function resolveDateKey(){
    if(typeof getCurrentDate === "function" && typeof yyyyMmDd === "function"){
      return yyyyMmDd(getCurrentDate());
    }
    return dateKey;
  }

  function buildScale(container, field, value){
    if(!container) return;
    const cur = value || "";
    container.innerHTML = "";
    for(let i = 1; i <= 5; i++){
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dot" + (cur === String(i) ? " active" : "");
      dot.setAttribute("aria-label", `${field} ${i}`);
      dot.addEventListener("click", () => {
        const key = resolveDateKey();
        captureUndo("Signal updated", () => {
          const nextDay = getDay(key);
          const next = (nextDay[field] === String(i)) ? "" : String(i);
          nextDay[field] = next;
          setDay(key, nextDay);
        });
        if(typeof rerender === "function"){
          rerender(key);
        }
      });
      container.appendChild(dot);
    }
  }
}
