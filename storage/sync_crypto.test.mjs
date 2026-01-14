// @ts-check

import { encryptSyncRecord, decryptSyncRecord, normalizeE2eeParams } from "./sync_crypto.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const payload = { hello: "world", count: 3 };
const passphrase = "horse battery staple";
const aad = { spaceId: "space-1", key: "logs/2026-01-01" };

const cipher = await encryptSyncRecord(payload, passphrase, {}, aad);
assert(cipher && cipher.type === "shredmaxx:sync_encrypted", "encryptSyncRecord returns typed payload");

const plain = await decryptSyncRecord(cipher, passphrase, aad);
assert(plain.hello === "world" && plain.count === 3, "decryptSyncRecord returns original payload");

let threw = false;
try{
  await decryptSyncRecord(cipher, passphrase, { spaceId: "space-1", key: "logs/2026-01-02" });
}catch(e){
  threw = true;
}
assert(threw, "decryptSyncRecord rejects with wrong AAD");

const params = normalizeE2eeParams({});
assert(params && typeof params.iterations === "number", "normalizeE2eeParams fills iterations");
assert(params && params.hash, "normalizeE2eeParams fills hash");

console.log("sync_crypto tests: ok");
