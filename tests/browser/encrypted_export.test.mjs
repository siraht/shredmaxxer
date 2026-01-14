// @ts-check

import { encryptExport, decryptExport } from "../../storage/encrypted_export.js";

export async function run({ assert }){
  if(!globalThis.crypto || !crypto.subtle){
    return { status: "skip", reason: "WebCrypto not available" };
  }

  const state = {
    meta: { appVersion: "1.0.0" },
    settings: { dayStart: "06:00" },
    rosters: {},
    logs: {}
  };

  const passphrase = "test-passphrase";
  const payload = await encryptExport(state, passphrase, { iterations: 1000 });
  assert(!!payload.ciphertext, "ciphertext present");

  const roundTrip = await decryptExport(payload, passphrase);
  assert(roundTrip.meta.appVersion === "1.0.0", "round-trip appVersion");

  let failed = false;
  try{
    await decryptExport(payload, "wrong-pass");
  }catch(e){
    failed = true;
  }
  assert(failed, "wrong passphrase fails");

  return { status: "pass" };
}
