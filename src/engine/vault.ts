import type { Draw, State } from "./types";

/**
 * End-to-end encryption for account data. The password never leaves the
 * browser in usable form for the data: a key is derived from it with PBKDF2 (SHA-256, 600k iterations, per
 * OWASP 2023) and the state is sealed with AES-256-GCM. The server only ever
 * stores the ciphertext, salt and IV, so it can't read anyone's bloodwork.
 */

export interface Vault {
  v: 1;
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

export const PBKDF2_ITERATIONS = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** extractable so a signed-in device can remember it instead of the password */
export async function deriveKey(pass: string, salt: Uint8Array<ArrayBuffer>, iter = PBKDF2_ITERATIONS, extractable = false): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"],
  );
}

export const newSalt = () => crypto.getRandomValues(new Uint8Array(16));

/** Encrypt with an already-derived key. A fresh IV every time; the salt is kept so the key can be derived again. */
export async function sealWithKey(value: unknown, key: CryptoKey, salt: string, iter = PBKDF2_ITERATIONS): Promise<Vault> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, iter, salt, iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

export async function openWithKey<T = unknown>(vault: Vault, key: CryptoKey): Promise<T> {
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(vault.iv) }, key, fromB64(vault.data));
  } catch {
    throw new WrongPassphrase();
  }
  return JSON.parse(dec.decode(pt)) as T;
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toB64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

export async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromB64(raw), { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function seal(value: unknown, pass: string, iter = PBKDF2_ITERATIONS): Promise<Vault> {
  const salt = newSalt();
  return sealWithKey(value, await deriveKey(pass, salt, iter), toB64(salt), iter);
}

export class WrongPassphrase extends Error {
  constructor() {
    super("That password doesn't unlock your saved data.");
  }
}

export async function open<T = unknown>(vault: Vault, pass: string): Promise<T> {
  // GCM's auth tag fails on a wrong key or any tampering
  return openWithKey<T>(vault, await deriveKey(pass, fromB64(vault.salt), vault.iter));
}

/**
 * Merge a synced copy with the local one. Saved draws are combined by id (so a
 * draw added on your phone and one added on your laptop both survive); for
 * everything else the more recently changed copy wins.
 */
export function mergeStates(local: State, remote: State): State {
  const newer = remote.updatedAt > local.updatedAt ? remote : local;
  const older = newer === remote ? local : remote;
  const byId = new Map<string, Draw>();
  for (const d of older.draws ?? []) byId.set(d.id, d);
  for (const d of newer.draws ?? []) byId.set(d.id, d);
  const draws = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { ...newer, draws, updatedAt: Math.max(local.updatedAt, remote.updatedAt) };
}
