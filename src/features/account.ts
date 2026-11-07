import type { SupabaseClient } from "@supabase/supabase-js";
import { normalize } from "../engine/state";
import type { State } from "../engine/types";
import {
  deriveKey,
  exportKey,
  fromB64,
  importKey,
  mergeStates,
  newSalt,
  openWithKey,
  PBKDF2_ITERATIONS,
  sealWithKey,
  toB64,
  type Vault,
} from "../engine/vault";

/**
 * Accounts, so people can sign in on any device and see their progress.
 *
 * Email + password through Supabase Auth. The same password also unlocks the
 * data: a key is derived from it in the browser and everything is sealed with
 * AES-256-GCM before upload, so the server only ever holds ciphertext. The key
 * is remembered on this device until sign-out, so you only type the password
 * when signing in.
 *
 * Off unless VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
 */

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const accountsEnabled = !!(URL_ && ANON);

let client: SupabaseClient | null = null;
async function sb(): Promise<SupabaseClient> {
  if (!accountsEnabled) throw new Error("Accounts aren't switched on yet.");
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(URL_!, ANON!, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } });
  }
  return client;
}

// ---------- the key, remembered per user on this device
const KEY_STORE = "spotter-key";
interface Stored {
  uid: string;
  salt: string;
  key: string;
}
function readKey(): Stored | null {
  try {
    const r = localStorage.getItem(KEY_STORE);
    return r ? (JSON.parse(r) as Stored) : null;
  } catch {
    return null;
  }
}
function writeKey(k: Stored | null) {
  try {
    if (k) localStorage.setItem(KEY_STORE, JSON.stringify(k));
    else localStorage.removeItem(KEY_STORE);
  } catch {
    /* ignore */
  }
}

export interface Account {
  uid: string;
  email: string;
}

/** The signed-in account with a usable key on this device, or null */
export async function current(): Promise<Account | null> {
  if (!accountsEnabled) return null;
  const c = await sb();
  const { data } = await c.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const k = readKey();
  if (!k || k.uid !== u.id) return null;
  return { uid: u.id, email: u.email ?? "" };
}

async function fetchVault(): Promise<Vault | null> {
  const c = await sb();
  const { data, error } = await c.from("vaults").select("vault").maybeSingle();
  if (error) throw error;
  return (data?.vault as Vault) ?? null;
}

/** Derive the key from the password (using the vault's salt if there is one) and remember it */
async function unlockWith(uid: string, password: string): Promise<void> {
  const v = await fetchVault();
  const salt = v?.salt ?? toB64(newSalt());
  const key = await deriveKey(password, fromB64(salt), v?.iter ?? PBKDF2_ITERATIONS, true);
  if (v) await openWithKey(v, key); // throws if the password doesn't match the data
  writeKey({ uid, salt, key: await exportKey(key) });
}

const friendly = (m: string) =>
  /invalid login/i.test(m)
    ? "Wrong email or password."
    : /already registered/i.test(m)
      ? "There's already an account with that email. Sign in instead."
      : /email not confirmed/i.test(m)
        ? "Confirm your email first: check your inbox for the link."
        : m;

export async function signUp(email: string, password: string): Promise<"signed-in" | "confirm-email"> {
  const c = await sb();
  const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + "/progress?signin=1" } });
  if (error) throw new Error(friendly(error.message));
  if (!data.session || !data.user) return "confirm-email";
  await unlockWith(data.user.id, password);
  return "signed-in";
}

export async function signIn(email: string, password: string): Promise<void> {
  const c = await sb();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error.message));
  try {
    await unlockWith(data.user.id, password);
  } catch (e) {
    await c.auth.signOut();
    throw e;
  }
}

export async function signOut(): Promise<void> {
  writeKey(null);
  if (!accountsEnabled) return;
  const c = await sb();
  await c.auth.signOut();
}

/**
 * Pull, merge, push. Draws from every device are kept; for everything else the
 * most recent change wins. Returns the merged state to load locally.
 */
export async function sync(local: State): Promise<State> {
  const c = await sb();
  const k = readKey();
  const { data } = await c.auth.getSession();
  const uid = data.session?.user.id;
  if (!k || !uid || k.uid !== uid) throw new Error("Signed out. Sign in again to save your progress.");
  const key = await importKey(k.key);
  const v = await fetchVault();
  // the sample never goes into an account: show the account's data instead, or keep the sample if there is none
  if (local.example) return v ? normalize(await openWithKey(v, key)) : local;
  const merged = v ? mergeStates(local, normalize(await openWithKey(v, key))) : local;
  const sealed = await sealWithKey(merged, key, k.salt);
  const { error } = await c.from("vaults").upsert({ user_id: uid, vault: sealed, updated_at: new Date().toISOString() });
  if (error) throw error;
  return merged;
}
