// @ts-check

/**
 * @typedef {Object} ExportOptions
 * @property {string} [appVersion]
 * @property {Date} [now]
 */

/**
 * Remove secret or derived-only fields from export payload.
 * @param {any} state
 * @returns {any}
 */
function sanitizeExportState(state){
  if(!state || typeof state !== "object") return {};
  const out = { ...state };
  const dropKeys = [
    "syncCredentials",
    "sync_credentials",
    "outbox",
    "dayIndex",
    "day_index",
    "weekIndex",
    "week_index",
    "auditLog",
    "audit_log"
  ];
  for(const key of dropKeys){
    if(Object.prototype.hasOwnProperty.call(out, key)){
      delete out[key];
    }
  }

  if(out.settings && typeof out.settings === "object"){
    const settings = { ...out.settings };
    if(settings.sync && typeof settings.sync === "object"){
      const sync = { ...settings.sync };
      const secretKeys = ["authToken", "token", "passphrase", "e2eePassphrase", "e2eeKey", "secret", "credentials", "syncLink"];
      for(const key of secretKeys){
        if(Object.prototype.hasOwnProperty.call(sync, key)){
          delete sync[key];
        }
      }
      settings.sync = sync;
    }
    out.settings = settings;
  }

  if(out.meta && typeof out.meta === "object"){
    const meta = { ...out.meta };
    if(meta.sync && typeof meta.sync === "object"){
      const sync = { ...meta.sync };
      const secretKeys = ["authToken", "token", "passphrase", "e2eePassphrase", "secret", "credentials"];
      for(const key of secretKeys){
        if(Object.prototype.hasOwnProperty.call(sync, key)){
          delete sync[key];
        }
      }
      meta.sync = sync;
    }
    out.meta = meta;
  }

  return out;
}

/**
 * Build a plain JSON export payload.
 * @param {any} state
 * @param {ExportOptions} [opts]
 * @returns {any}
 */
export function buildExportPayload(state, opts = {}){
  const now = opts.now instanceof Date ? opts.now : new Date();
  const base = sanitizeExportState(state);
  const appVersion = opts.appVersion || base?.meta?.appVersion || "";
  const logs = base.logs && typeof base.logs === "object" ? base.logs : {};
  const sortedLogs = Object.keys(logs).sort().reduce((acc, key) => {
    acc[key] = logs[key];
    return acc;
  }, {});
  return {
    ...base,
    logs: sortedLogs,
    exportedAt: now.toISOString(),
    appVersion
  };
}

/**
 * Serialize the export payload to JSON text.
 * @param {any} state
 * @param {ExportOptions} [opts]
 * @returns {string}
 */
export function serializeExport(state, opts = {}){
  return JSON.stringify(buildExportPayload(state, opts), null, 2);
}

export default {
  buildExportPayload,
  serializeExport
};
