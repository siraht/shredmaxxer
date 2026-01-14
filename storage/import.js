// @ts-check

import { validateImportPayload } from "./validate.js";

/**
 * @typedef {Object} ImportParseResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {unknown} [payload]
 * @property {boolean} [legacy]
 * @property {number} [version]
 */

/**
 * Parse JSON text and validate payload for import.
 * @param {string} text
 * @returns {ImportParseResult}
 */
export function parseImportText(text){
  if(typeof text !== "string"){
    return { ok: false, errors: ["Import text must be a string."] };
  }

  let payload;
  try{
    payload = JSON.parse(text);
  }catch(e){
    return { ok: false, errors: ["Import failed: invalid JSON."] };
  }

  const result = validateImportPayload(payload);
  if(result.ok){
    return { ok: true, errors: [], payload };
  }

  return {
    ok: false,
    errors: result.errors,
    legacy: result.legacy,
    version: result.version,
    payload
  };
}

export default parseImportText;
