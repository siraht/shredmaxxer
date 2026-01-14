// @ts-check

import migrateV3ToV4 from "./migrate.js";

/**
 * Compatibility wrapper for v3 -> v4 migration.
 * @param {any} legacyState
 * @param {any} [opts]
 */
export function migrateV3State(legacyState, opts){
  return migrateV3ToV4(legacyState, opts);
}

export default {
  migrateV3State
};
