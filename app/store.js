// @ts-check

/**
 * @typedef {Object} Action
 * @property {string} type
 * @property {any} [payload]
 */

/**
 * @typedef {(state: any, action: Action) => any} Reducer
 */

/**
 * @typedef {(action: Action, nextState: any, prevState: any) => void} Effect
 */

/**
 * Create a tiny unidirectional store.
 * - reducer is pure
 * - effects run after state updates (persistence, analytics, etc.)
 * @param {{
 *  reducer: Reducer,
 *  initialState: any,
 *  effects?: Effect[],
 * }} opts
 */
export function createStore(opts){
  const reducer = opts.reducer;
  let state = opts.initialState;
  /** @type {Set<Function>} */
  const listeners = new Set();
  const effects = Array.isArray(opts.effects) ? opts.effects : [];

  /** @param {Action} action */
  function dispatch(action){
    const prev = state;
    const next = reducer(state, action);
    if(next !== prev){
      state = next;
      for(const effect of effects){
        effect(action, next, prev);
      }
      for(const fn of listeners){
        fn(next, prev, action);
      }
    }
    return action;
  }

  function getState(){
    return state;
  }

  /** @param {(next:any, prev:any, action:Action)=>void} fn */
  function subscribe(fn){
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { dispatch, getState, subscribe };
}
