// @ts-check

import { mergeLogs, validateImportPayload } from "./import_logic.js";
import { createDefaultDay } from "./helpers.js";
import { createDefaultRosters } from "../domain/roster_defaults.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

{
  const base = {
    "2026-01-01": { ...createDefaultDay(), rev: 2 },
    "2026-01-02": { ...createDefaultDay(), rev: 1 }
  };
  const incoming = {
    "2026-01-01": { ...createDefaultDay(), rev: 1 },
    "2026-01-03": { ...createDefaultDay(), rev: 1 }
  };
  const merged = mergeLogs(base, incoming);
  assert(merged["2026-01-01"].rev === 2, "mergeLogs keeps higher-rev day");
  assert(merged["2026-01-03"], "mergeLogs adds new days");
}

{
  const bad = validateImportPayload(null);
  assert(!bad.ok, "invalid payload should fail");
}

{
  const legacy = validateImportPayload({ version: 3, logs: {} });
  assert(legacy.ok && legacy.legacy, "legacy payload should be accepted for migration");
}

{
  const invalidLogs = validateImportPayload({ version: 3, logs: "nope" });
  assert(!invalidLogs.ok, "legacy payload with invalid logs should fail");
}

{
  const payload = {
    version: 4,
    meta: {
      version: 4,
      installId: "install-1",
      storageMode: "idb",
      persistStatus: "unknown"
    },
    settings: {
      dayStart: "06:00",
      dayEnd: "23:59",
      ftnEnd: "12:00",
      lunchEnd: "16:00",
      dinnerEnd: "21:00",
      sunrise: "07:00",
      sunset: "17:00",
      focusMode: "full",
      sunMode: "manual",
      phase: "",
      weekStart: 0,
      nudgesEnabled: false,
      supplementsMode: "none",
      privacy: {
        appLock: false,
        redactHome: false,
        exportEncryptedByDefault: false,
        blurOnBackground: false
      }
    },
    rosters: createDefaultRosters(new Date("2026-01-01T00:00:00.000Z")),
    logs: {
      "2026-01-15": createDefaultDay()
    }
  };

  const ok = validateImportPayload(payload);
  assert(ok.ok && ok.version === 4, "valid v4 payload should pass");
}

console.log("import logic tests: ok");
