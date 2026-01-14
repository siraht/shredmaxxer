// @ts-check

/**
 * @typedef {Record<string, HTMLElement | null>} RouteMap
 */

/**
 * @param {HTMLElement} root
 * @param {RouteMap} routes
 * @param {string} defaultRoute
 */
function buildRouter(root, routes, defaultRoute){
  const keys = Object.keys(routes);
  const isValid = (route) => keys.includes(route);

  const getRouteFromHash = () => {
    const raw = window.location.hash.replace(/^#/, "").replace(/^\\//, "");
    return isValid(raw) ? raw : defaultRoute;
  };

  const applyRoute = (route) => {
    const next = isValid(route) ? route : defaultRoute;
    root.dataset.route = next;
    for(const [name, view] of Object.entries(routes)){
      if(!view) continue;
      view.classList.toggle("hidden", name !== next);
    }
    root.querySelectorAll("[data-route]").forEach((el) => {
      const active = el.dataset.route === next;
      el.classList.toggle("tab-active", active);
      if(active) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  };

  const setRoute = (route, options = {}) => {
    const next = isValid(route) ? route : defaultRoute;
    const push = options.push !== false;
    if(push){
      const hash = `#${next}`;
      if(window.location.hash !== hash){
        window.location.hash = hash;
      }
    }
    applyRoute(next);
  };

  const syncFromHash = () => applyRoute(getRouteFromHash());

  window.addEventListener("hashchange", syncFromHash);
  syncFromHash();

  return { setRoute, syncFromHash, getRouteFromHash };
}

/**
 * @param {{ root: HTMLElement, routes: RouteMap, defaultRoute?: string }} opts
 */
export function initRouter(opts){
  const { root, routes } = opts;
  const defaultRoute = opts.defaultRoute || "today";
  return buildRouter(root, routes, defaultRoute);
}
