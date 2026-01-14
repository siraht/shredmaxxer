// @ts-check

import { initRouter } from "./router.js";

export function initShell(){
  const root = document.getElementById("app");
  if(!root) return null;

  const routes = {
    today: root.querySelector("[data-view='today']"),
    history: root.querySelector("[data-view='history']"),
    review: root.querySelector("[data-view='review']"),
    settings: root.querySelector("[data-view='settings']"),
    day: root.querySelector("[data-view='day']")
  };

  const router = initRouter({ root, routes, defaultRoute: "today" });

  root.addEventListener("click", (event) => {
    const target = event.target;
    if(!(target instanceof Element)) return;
    const actionEl = target.closest("[data-action]");
    if(!actionEl || !root.contains(actionEl)) return;
    const action = actionEl.dataset.action;
    if(action === "route"){
      const route = actionEl.dataset.route;
      if(route) router.setRoute(route);
    }
  });

  return router;
}
