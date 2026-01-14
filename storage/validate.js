// @ts-check

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ERRORS = 25;

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {boolean} [legacy]
 * @property {number} [version]
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value){
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isString(value){
  return typeof value === "string";
}

/**
 * @param {unknown} value
 * @returns {value is boolean}
 */
function isBoolean(value){
  return typeof value === "boolean";
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isNumber(value){
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
function isStringArray(value){
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * @param {string[]} errors
 * @param {string} message
 */
function pushError(errors, message){
  if(errors.length < MAX_ERRORS){
    errors.push(message);
  }
}

/**
 * @param {unknown} settings
 * @param {string[]} errors
 * @param {string} path
 */
function validateSettings(settings, errors, path){
  if(!isPlainObject(settings)){
    pushError(errors, `${path} must be an object.`);
    return;
  }

  const requiredTimes = [
    "dayStart",
    "dayEnd",
    "ftnEnd",
    "lunchEnd",
    "dinnerEnd",
    "sunrise",
    "sunset"
  ];

  for(const key of requiredTimes){
    if(!isString(settings[key])){
      pushError(errors, `${path}.${key} must be a string (HH:MM).`);
    }
  }

  if(settings.focusMode !== "full" && settings.focusMode !== "nowfade"){
    pushError(errors, `${path}.focusMode must be \"full\" or \"nowfade\".`);
  }

  if(settings.sunMode !== "manual" && settings.sunMode !== "auto"){
    pushError(errors, `${path}.sunMode must be \"manual\" or \"auto\".`);
  }

  if(!isString(settings.phase)){
    pushError(errors, `${path}.phase must be a string.`);
  }else if(settings.phase && !["strict", "maintenance", "advanced"].includes(settings.phase)){
    pushError(errors, `${path}.phase must be \"strict\", \"maintenance\", \"advanced\", or empty.`);
  }

  if(!isPlainObject(settings.privacy)){
    pushError(errors, `${path}.privacy must be an object.`);
  }else{
    if(!isBoolean(settings.privacy.appLock)){
      pushError(errors, `${path}.privacy.appLock must be a boolean.`);
    }
    if(!isBoolean(settings.privacy.redactHome)){
      pushError(errors, `${path}.privacy.redactHome must be a boolean.`);
    }
    if(!isBoolean(settings.privacy.exportEncryptedByDefault)){
      pushError(errors, `${path}.privacy.exportEncryptedByDefault must be a boolean.`);
    }
  }

  if(settings.weekStart !== undefined){
    if(!isNumber(settings.weekStart) || settings.weekStart < 0 || settings.weekStart > 6){
      pushError(errors, `${path}.weekStart must be a number between 0 and 6.`);
    }
  }

  if(settings.lastKnownLat !== undefined && !isNumber(settings.lastKnownLat)){
    pushError(errors, `${path}.lastKnownLat must be a number if present.`);
  }
  if(settings.lastKnownLon !== undefined && !isNumber(settings.lastKnownLon)){
    pushError(errors, `${path}.lastKnownLon must be a number if present.`);
  }
}

/**
 * @param {unknown} item
 * @param {string[]} errors
 * @param {string} path
 */
function validateRosterItem(item, errors, path){
  if(!isPlainObject(item)){
    pushError(errors, `${path} must be an object.`);
    return;
  }

  if(!isString(item.id)){
    pushError(errors, `${path}.id must be a string.`);
  }
  if(!isString(item.label)){
    pushError(errors, `${path}.label must be a string.`);
  }
  if(!isStringArray(item.aliases)){
    pushError(errors, `${path}.aliases must be an array of strings.`);
  }
  if(!isStringArray(item.tags)){
    pushError(errors, `${path}.tags must be an array of strings.`);
  }
  if(!isBoolean(item.pinned)){
    pushError(errors, `${path}.pinned must be a boolean.`);
  }
  if(!isBoolean(item.archived)){
    pushError(errors, `${path}.archived must be a boolean.`);
  }
  if(!isString(item.tsCreated)){
    pushError(errors, `${path}.tsCreated must be an ISO string.`);
  }
  if(!isString(item.tsUpdated)){
    pushError(errors, `${path}.tsUpdated must be an ISO string.`);
  }
}

/**
 * @param {unknown} rosters
 * @param {string[]} errors
 * @param {string} path
 */
function validateRosters(rosters, errors, path){
  if(!isPlainObject(rosters)){
    pushError(errors, `${path} must be an object.`);
    return;
  }

  const categories = ["proteins", "carbs", "fats", "micros"];
  for(const key of categories){
    const list = rosters[key];
    if(!Array.isArray(list)){
      pushError(errors, `${path}.${key} must be an array.`);
      continue;
    }
    list.forEach((item, idx) => validateRosterItem(item, errors, `${path}.${key}[${idx}]`));
  }
}

/**
 * @param {unknown} segment
 * @param {string[]} errors
 * @param {string} path
 */
function validateSegmentLog(segment, errors, path){
  if(!isPlainObject(segment)){
    pushError(errors, `${path} must be an object.`);
    return;
  }

  if(!isString(segment.status)){
    pushError(errors, `${path}.status must be a string.`);
  }else if(segment.status && !["unlogged", "none", "logged"].includes(segment.status)){
    pushError(errors, `${path}.status must be \"unlogged\", \"none\", \"logged\", or empty.`);
  }

  const arrays = ["proteins", "carbs", "fats", "micros"];
  for(const key of arrays){
    if(!isStringArray(segment[key])){
      pushError(errors, `${path}.${key} must be an array of ItemId strings.`);
    }
  }

  if(!isString(segment.collision)){
    pushError(errors, `${path}.collision must be a tri-state string.`);
  }else if(segment.collision && !["auto", "yes", "no"].includes(segment.collision)){
    pushError(errors, `${path}.collision must be \"auto\", \"yes\", \"no\", or empty.`);
  }

  if(!isString(segment.seedOil)){
    pushError(errors, `${path}.seedOil must be a string.`);
  }else if(segment.seedOil && !["none", "yes"].includes(segment.seedOil)){
    pushError(errors, `${path}.seedOil must be \"none\", \"yes\", or empty.`);
  }

  if(!isString(segment.highFatMeal)){
    pushError(errors, `${path}.highFatMeal must be a tri-state string.`);
  }else if(segment.highFatMeal && !["auto", "yes", "no"].includes(segment.highFatMeal)){
    pushError(errors, `${path}.highFatMeal must be \"auto\", \"yes\", \"no\", or empty.`);
  }

  if(!isString(segment.notes)){
    pushError(errors, `${path}.notes must be a string.`);
  }

  if(segment.ftnMode !== undefined){
    if(!isString(segment.ftnMode)){
      pushError(errors, `${path}.ftnMode must be a string.`);
    }else if(segment.ftnMode && !["ftn", "lite", "off"].includes(segment.ftnMode)){
      pushError(errors, `${path}.ftnMode must be \"ftn\", \"lite\", \"off\", or empty.`);
    }
  }

  if(segment.tsFirst !== undefined && !isString(segment.tsFirst)){
    pushError(errors, `${path}.tsFirst must be a string if present.`);
  }
  if(segment.tsLast !== undefined && !isString(segment.tsLast)){
    pushError(errors, `${path}.tsLast must be a string if present.`);
  }
  if(!isNumber(segment.rev)){
    pushError(errors, `${path}.rev must be a number.`);
  }
}

/**
 * @param {unknown} day
 * @param {string[]} errors
 * @param {string} path
 */
function validateDayLog(day, errors, path){
  if(!isPlainObject(day)){
    pushError(errors, `${path} must be an object.`);
    return;
  }

  if(!isPlainObject(day.segments)){
    pushError(errors, `${path}.segments must be an object.`);
  }else{
    const segIds = ["ftn", "lunch", "dinner", "late"];
    for(const id of segIds){
      validateSegmentLog(day.segments[id], errors, `${path}.segments.${id}`);
    }
  }

  if(!isBoolean(day.movedBeforeLunch)){
    pushError(errors, `${path}.movedBeforeLunch must be a boolean.`);
  }
  if(!isBoolean(day.trained)){
    pushError(errors, `${path}.trained must be a boolean.`);
  }
  if(!isBoolean(day.highFatDay)){
    pushError(errors, `${path}.highFatDay must be a boolean.`);
  }

  if(!isString(day.energy)){
    pushError(errors, `${path}.energy must be a string.`);
  }else if(day.energy && !["1", "2", "3", "4", "5"].includes(day.energy)){
    pushError(errors, `${path}.energy must be \"1\"..\"5\" or empty.`);
  }
  if(!isString(day.mood)){
    pushError(errors, `${path}.mood must be a string.`);
  }else if(day.mood && !["1", "2", "3", "4", "5"].includes(day.mood)){
    pushError(errors, `${path}.mood must be \"1\"..\"5\" or empty.`);
  }
  if(!isString(day.cravings)){
    pushError(errors, `${path}.cravings must be a string.`);
  }else if(day.cravings && !["1", "2", "3", "4", "5"].includes(day.cravings)){
    pushError(errors, `${path}.cravings must be \"1\"..\"5\" or empty.`);
  }

  if(!isString(day.notes)){
    pushError(errors, `${path}.notes must be a string.`);
  }
  if(!isString(day.tsCreated)){
    pushError(errors, `${path}.tsCreated must be an ISO string.`);
  }
  if(!isString(day.tsLast)){
    pushError(errors, `${path}.tsLast must be an ISO string.`);
  }
  if(!isNumber(day.rev)){
    pushError(errors, `${path}.rev must be a number.`);
  }
}

/**
 * @param {unknown} logs
 * @param {string[]} errors
 * @param {string} path
 */
function validateLogs(logs, errors, path){
  if(!isPlainObject(logs)){
    pushError(errors, `${path} must be an object keyed by DateKey.`);
    return;
  }

  for(const [dateKey, day] of Object.entries(logs)){
    if(!DATE_KEY_RE.test(dateKey)){
      pushError(errors, `${path} key \"${dateKey}\" is not a DateKey (YYYY-MM-DD).`);
    }
    validateDayLog(day, errors, `${path}[${dateKey}]`);
    if(errors.length >= MAX_ERRORS){
      pushError(errors, "Too many validation errors; stopping early.");
      break;
    }
  }
}

/**
 * @param {unknown} insights
 * @param {string[]} errors
 * @param {string} path
 */
function validateInsights(insights, errors, path){
  if(insights === undefined || insights === null) return;
  if(!isPlainObject(insights)){
    pushError(errors, `${path} must be an object.`);
    return;
  }
  if(!isPlainObject(insights.dismissed)){
    pushError(errors, `${path}.dismissed must be an object.`);
    return;
  }

  const validateScope = (scopeMap, scopePath) => {
    if(!isPlainObject(scopeMap)){
      pushError(errors, `${scopePath} must be an object keyed by scope.`);
      return;
    }
    for(const [scopeKey, rules] of Object.entries(scopeMap)){
      if(!isPlainObject(rules)){
        pushError(errors, `${scopePath}[${scopeKey}] must be an object of ruleId->timestamp.`);
        continue;
      }
      for(const [ruleId, ts] of Object.entries(rules)){
        if(!isString(ruleId)){
          pushError(errors, `${scopePath}[${scopeKey}] has a non-string rule id.`);
        }
        if(!isString(ts)){
          pushError(errors, `${scopePath}[${scopeKey}].${ruleId} must be a timestamp string.`);
        }
      }
    }
  };

  validateScope(insights.dismissed.day, `${path}.dismissed.day`);
  validateScope(insights.dismissed.week, `${path}.dismissed.week`);
}

/**
 * Validate a v4 import payload before any writes.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateImportPayload(payload){
  const errors = [];

  if(!isPlainObject(payload)){
    return { ok: false, errors: ["Payload must be an object."] };
  }

  const version = payload.version;
  if(version !== 4){
    if(isNumber(version) && version > 0 && version < 4){
      return {
        ok: false,
        errors: [`Legacy payload version ${version} requires migration.`],
        legacy: true,
        version
      };
    }
    return {
      ok: false,
      errors: ["Unsupported or missing version."],
      version: isNumber(version) ? version : undefined
    };
  }

  if(!isPlainObject(payload.meta)){
    pushError(errors, "meta must be an object.");
  }else{
    if(payload.meta.version !== 4){
      pushError(errors, "meta.version must be 4.");
    }
    if(!isString(payload.meta.installId)){
      pushError(errors, "meta.installId must be a string.");
    }
    if(!isString(payload.meta.storageMode) || !["idb", "localStorage"].includes(payload.meta.storageMode)){
      pushError(errors, "meta.storageMode must be \"idb\" or \"localStorage\".");
    }
    if(!isString(payload.meta.persistStatus) || !["", "unknown", "granted", "denied"].includes(payload.meta.persistStatus)){
      pushError(errors, "meta.persistStatus must be \"unknown\", \"granted\", \"denied\", or empty.");
    }
  }

  validateSettings(payload.settings, errors, "settings");
  validateRosters(payload.rosters, errors, "rosters");
  validateInsights(payload.insights, errors, "insights");
  validateLogs(payload.logs, errors, "logs");

  return { ok: errors.length === 0, errors, version: 4 };
}

export default validateImportPayload;
