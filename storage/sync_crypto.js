// @ts-check

const DEFAULT_ITERATIONS = 100_000;
const DEFAULT_HASH = "SHA-256";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes){
  if(typeof Buffer !== "undefined"){
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBytes(str){
  if(typeof Buffer !== "undefined"){
    return new Uint8Array(Buffer.from(str, "base64"));
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i++){
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomBytes(length){
  if(!globalThis.crypto || typeof crypto.getRandomValues !== "function"){
    throw new Error("Secure random bytes not available");
  }
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

async function deriveKey(passphrase, salt, iterations, hash){
  if(!globalThis.crypto || !crypto.subtle){
    throw new Error("WebCrypto not available");
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function buildAad(spaceId, key){
  return encoder.encode(JSON.stringify({ spaceId, key }));
}

/**
 * @param {any} value
 * @param {string} passphrase
 * @param {{iterations?:number, hash?:string, salt?:string}} params
 * @param {{spaceId:string, key:string}} aad
 */
export async function encryptSyncRecord(value, passphrase, params, aad){
  if(!passphrase){
    throw new Error("Passphrase required");
  }
  const iterations = Number.isFinite(params?.iterations) ? params.iterations : DEFAULT_ITERATIONS;
  const hash = params?.hash || DEFAULT_HASH;
  const salt = params?.salt ? base64ToBytes(params.salt) : randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(passphrase, salt, iterations, hash);
  const plainText = JSON.stringify(value ?? null);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: buildAad(aad.spaceId, aad.key) },
    key,
    encoder.encode(plainText)
  );
  return {
    type: "shredmaxx:sync_encrypted",
    version: 1,
    kdf: "PBKDF2",
    hash,
    iterations,
    cipher: "AES-GCM",
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer))
  };
}

/**
 * @param {any} payload
 * @param {string} passphrase
 * @param {{spaceId:string, key:string}} aad
 */
export async function decryptSyncRecord(payload, passphrase, aad){
  if(!payload || typeof payload !== "object"){
    throw new Error("Invalid encrypted payload");
  }
  if(!passphrase){
    throw new Error("Passphrase required");
  }
  const iterations = Number.isFinite(payload.iterations) ? payload.iterations : DEFAULT_ITERATIONS;
  const hash = payload.hash || DEFAULT_HASH;
  const salt = base64ToBytes(payload.salt || "");
  const iv = base64ToBytes(payload.iv || "");
  const ciphertext = base64ToBytes(payload.ciphertext || "");
  const key = await deriveKey(passphrase, salt, iterations, hash);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: buildAad(aad.spaceId, aad.key) },
    key,
    ciphertext
  );
  const plainText = decoder.decode(plainBuffer);
  return JSON.parse(plainText);
}

export function normalizeE2eeParams(payload){
  if(!payload || typeof payload !== "object") return null;
  return {
    iterations: Number.isFinite(payload.iterations) ? payload.iterations : DEFAULT_ITERATIONS,
    hash: payload.hash || DEFAULT_HASH,
    salt: payload.salt || ""
  };
}

export { DEFAULT_ITERATIONS, DEFAULT_HASH };
export {};
