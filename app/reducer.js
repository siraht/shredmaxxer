// @ts-check

/**
 * Minimal reducer with common mutation patterns.
 * Extend with domain-specific action types as modules land.
 * @param {any} state
 * @param {{type:string, payload?:any}} action
 */
export function reducer(state, action){
  switch(action.type){
    case "SET_SETTINGS":
      return { ...state, settings: action.payload };
    case "SET_ROSTERS":
      return { ...state, rosters: action.payload };
    case "UPSERT_DAY": {
      const { dateKey, day } = action.payload || {};
      if(!dateKey) return state;
      return { ...state, logs: { ...state.logs, [dateKey]: day } };
    }
    case "PATCH_DAY": {
      const { dateKey, patch } = action.payload || {};
      if(!dateKey || !patch) return state;
      const existing = state.logs?.[dateKey] || {};
      return { ...state, logs: { ...state.logs, [dateKey]: { ...existing, ...patch } } };
    }
    default:
      return state;
  }
}
