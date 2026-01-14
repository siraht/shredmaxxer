// @ts-check

/**
 * @typedef {Record<string, (() => void)>} Renderers
 */

/**
 * Create a render scheduler that batches region updates to one RAF tick.
 * @param {Renderers} renderers
 */
export function createRenderScheduler(renderers){
  const dirty = new Set();
  let scheduled = false;

  const schedule = () => {
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const toRender = Array.from(dirty);
      dirty.clear();
      for(const region of toRender){
        const render = renderers[region];
        if(typeof render === "function") render();
      }
    });
  };

  /** @param {string} region */
  const markDirty = (region) => {
    if(!renderers[region]) return;
    dirty.add(region);
    schedule();
  };

  const renderAll = () => {
    for(const region of Object.keys(renderers)){
      dirty.add(region);
    }
    schedule();
  };

  return { markDirty, renderAll };
}
