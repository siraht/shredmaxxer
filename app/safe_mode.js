// @ts-check

/**
 * @param {{
 *  isSafeMode: () => boolean,
 *  notify?: () => void,
 *  allow?: string[],
 *  blockedReturn?: Record<string, any>
 * }} options
 */
export function createSafeModeGuards(options){
  const allow = new Set(options?.allow || []);
  const isSafeMode = typeof options?.isSafeMode === "function" ? options.isSafeMode : () => false;
  const notify = typeof options?.notify === "function" ? options.notify : () => {};
  const blockedReturn = options?.blockedReturn || {};

  return function guardActions(actions){
    const guarded = {};
    for(const [name, fn] of Object.entries(actions)){
      guarded[name] = typeof fn === "function"
        ? function(...args){
          if(isSafeMode() && name === "canCopyYesterday"){
            return false;
          }
          if(isSafeMode() && !allow.has(name)){
            const fallback = blockedReturn[name];
            if(typeof fallback === "function"){
              return fallback();
            }
            if(fallback){
              return fallback;
            }
            notify();
            return;
          }
          return fn(...args);
        }
        : fn;
    }
    return guarded;
  };
}

export {};
