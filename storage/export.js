// @ts-check

/**
 * @typedef {Object} ExportOptions
 * @property {string} [appVersion]
 * @property {Date} [now]
 */

/**
 * Build a plain JSON export payload.
 * @param {any} state
 * @param {ExportOptions} [opts]
 * @returns {any}
 */
export function buildExportPayload(state, opts = {}){
  const now = opts.now instanceof Date ? opts.now : new Date();
  const base = state && typeof state === "object" ? state : {};
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
