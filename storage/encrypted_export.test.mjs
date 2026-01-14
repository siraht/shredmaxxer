// @ts-check

import { encryptExport, decryptExport } from "./encrypted_export.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

if(!globalThis.crypto || !crypto.subtle){
  console.log("encrypted export tests: skipped (no WebCrypto)");
  process.exit(0);
}

const state = {
  meta: { appVersion: "1.0.0" },
  settings: { dayStart: "06:00" },
  rosters: {},
  logs: {}
};

const passphrase = "test-passphrase";
const payload = await encryptExport(state, passphrase, { iterations: 1000 });
assert(payload && payload.ciphertext, "ciphertext present");

const roundTrip = await decryptExport(payload, passphrase);
assert(roundTrip.meta.appVersion === "1.0.0", "round-trip appVersion");

let failed = false;
try{
  await decryptExport(payload, "wrong-pass");
}catch(e){
  failed = true;
}
assert(failed, "wrong passphrase fails");

console.log("encrypted export tests: ok");
