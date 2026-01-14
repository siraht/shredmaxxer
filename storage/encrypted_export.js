// @ts-check

import { serializeExport } from "./export.js";

const DEFAULT_ITERATIONS = 100_000;
const DEFAULT_HASH = "SHA-256";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
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

/**
 * @param {string} str
 * @returns {Uint8Array}
 */
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

/**
 * @param {number} length
 * @returns {Uint8Array}
 */
function randomBytes(length){
  if(!globalThis.crypto || typeof crypto.getRandomValues !== "function"){
    throw new Error("Secure random bytes not available");
  }
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

/**
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @param {number} iterations
 * @param {string} hash
 */
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

/**
 * Encrypt the export payload using AES-GCM + PBKDF2.
 * @param {any} state
 * @param {string} passphrase
 * @param {{
 *  iterations?: number,
 *  hash?: string,
 *  salt?: Uint8Array,
 *  iv?: Uint8Array,
 *  exportOptions?: any
 * }} [opts]
 */
export async function encryptExport(state, passphrase, opts = {}){
  if(!passphrase){
    throw new Error("Passphrase required");
  }
  const iterations = Number.isFinite(opts.iterations) ? opts.iterations : DEFAULT_ITERATIONS;
  const hash = opts.hash || DEFAULT_HASH;
  const salt = opts.salt || randomBytes(16);
  const iv = opts.iv || randomBytes(12);
  const plainText = serializeExport(state, opts.exportOptions || {});
  const key = await deriveKey(passphrase, salt, iterations, hash);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plainText));
  return {
    type: "shredmaxx:encrypted",
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
 * Decrypt an encrypted export payload.
 * @param {any} payload
 * @param {string} passphrase
 */
export async function decryptExport(payload, passphrase){
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
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const plainText = decoder.decode(plainBuffer);
  return JSON.parse(plainText);
}

export {};
