import type { Draw, State } from "./types";

/**
 * End-to-end encryption for synced data. The passphrase never leaves the
 * browser: a key is derived from it with PBKDF2 (SHA-256, 600k iterations, per
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

async function deriveKey(pass: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function seal(value: unknown, pass: string, iter = PBKDF2_ITERATIONS): Promise<Vault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, iter);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, iter, salt: toB64(salt), iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

export class WrongPassphrase extends Error {
  constructor() {
    super("That passphrase doesn't unlock this data.");
  }
}

export async function open<T = unknown>(vault: Vault, pass: string): Promise<T> {
  const key = await deriveKey(pass, fromB64(vault.salt), vault.iter);
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(vault.iv) }, key, fromB64(vault.data));
  } catch {
    // GCM's auth tag fails on a wrong key or any tampering
    throw new WrongPassphrase();
  }
  return JSON.parse(dec.decode(pt)) as T;
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
