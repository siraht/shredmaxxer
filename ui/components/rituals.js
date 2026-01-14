// @ts-check

import { normalizeTri } from "../../domain/heuristics.js";

export function renderRituals({ els, day }){
  const setPressed = (btn, on) => btn.setAttribute("aria-pressed", on ? "true" : "false");

  setPressed(els.movedBeforeLunch, day.movedBeforeLunch);
  setPressed(els.trained, day.trained);
  const highFatValue = normalizeTri(day.highFatDay);
  setPressed(els.highFatDay, highFatValue === "yes");

  els.moveSub.textContent = day.movedBeforeLunch ? "Done" : "Not yet";
  els.trainSub.textContent = day.trained ? "Done" : "Not yet";
  if(highFatValue === "yes"){
    els.fatDaySub.textContent = "Marked";
  }else if(highFatValue === "no"){
    els.fatDaySub.textContent = "Not marked";
  }else{
    els.fatDaySub.textContent = "Auto";
  }
}
