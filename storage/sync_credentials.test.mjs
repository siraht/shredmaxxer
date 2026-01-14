// @ts-check

import { buildSyncLink, parseSyncLink } from "./sync_credentials.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const baseCreds = {
  spaceId: "space-123",
  authToken: "token-abc",
  endpoint: "/api/sync/v1"
};

const link = buildSyncLink(baseCreds);
assert(link.startsWith("shredmaxx://sync"), "buildSyncLink uses custom scheme");

const parsed = parseSyncLink(link);
assert(parsed && parsed.spaceId === baseCreds.spaceId, "parseSyncLink preserves spaceId");
assert(parsed && parsed.authToken === baseCreds.authToken, "parseSyncLink preserves authToken");
assert(parsed && parsed.endpoint === baseCreds.endpoint, "parseSyncLink preserves endpoint");

const e2eeCreds = {
  ...baseCreds,
  e2ee: { enabled: true, salt: "salt-base64", hash: "SHA-256", iterations: 1234 }
};
const e2eeLink = buildSyncLink(e2eeCreds);
const parsedE2ee = parseSyncLink(e2eeLink);
assert(parsedE2ee && parsedE2ee.e2ee?.enabled === true, "parseSyncLink sets e2ee enabled");
assert(parsedE2ee && parsedE2ee.e2ee?.salt === "salt-base64", "parseSyncLink preserves salt");
assert(parsedE2ee && parsedE2ee.e2ee?.hash === "SHA-256", "parseSyncLink preserves hash");
assert(parsedE2ee && parsedE2ee.e2ee?.iterations === 1234, "parseSyncLink preserves iterations");

assert(parseSyncLink("not-a-link") === null, "parseSyncLink rejects invalid link");
assert(buildSyncLink({}) === "", "buildSyncLink returns empty string when missing creds");

console.log("sync_credentials tests: ok");
