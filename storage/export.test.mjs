// @ts-check

import { buildExportPayload, serializeExport } from "./export.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const state = {
  version: 4,
  meta: { appVersion: "1.2.3", sync: { status: "idle", authToken: "secret-meta" } },
  settings: {
    sync: { mode: "hosted", endpoint: "/api/sync/v1", authToken: "secret", passphrase: "nope" }
  },
  rosters: {},
  syncCredentials: { token: "secret" },
  outbox: [{ id: "op-1" }],
  logs: {
    "2026-01-02": { a: 2 },
    "2026-01-01": { a: 1 }
  }
};

const fixed = new Date("2026-01-10T12:00:00.000Z");
const payload = buildExportPayload(state, { now: fixed });
assert(payload.exportedAt === fixed.toISOString(), "exportedAt matches now");
assert(payload.appVersion === "1.2.3", "appVersion falls back to meta");
assert(Object.keys(payload.logs).join(",") === "2026-01-01,2026-01-02", "logs are sorted by DateKey");
assert(!("syncCredentials" in payload), "syncCredentials removed from export");
assert(!("outbox" in payload), "outbox removed from export");
assert(payload.settings.sync.authToken === undefined, "sync authToken stripped");
assert(payload.settings.sync.passphrase === undefined, "sync passphrase stripped");
assert(payload.meta.sync.authToken === undefined, "meta sync secrets stripped");

const payload2 = buildExportPayload(state, { now: fixed, appVersion: "2.0.0" });
assert(payload2.appVersion === "2.0.0", "appVersion override works");

const text = serializeExport(state, { now: fixed, appVersion: "2.0.0" });
assert(typeof text === "string" && text.includes("exportedAt"), "serializeExport returns JSON string");

console.log("export tests: ok");
