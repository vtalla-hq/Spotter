import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { normalize } from "../engine/state";
import type { State } from "../engine/types";
import { mergeStates, open, seal, type Vault } from "../engine/vault";

/**
 * Optional sync across devices, end-to-end encrypted.
 *
 * Sign-in is a Supabase email link. Before anything leaves the browser it's
 * sealed with AES-GCM under a key derived from a passphrase only the user
 * knows (see engine/vault.ts). The vaults table holds one ciphertext row per
 * user, and row-level security means a signed-in user can only touch their own
 * row (supabase/schema.sql). Lose the passphrase and the synced copy is gone;
 * the copy in the browser is unaffected.
 *
 * Off unless VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
 */

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const syncConfigured = !!(URL_ && KEY);

let client: SupabaseClient | null = null;
async function sb(): Promise<SupabaseClient> {
  if (!syncConfigured) throw new Error("Sync isn't set up on this site.");
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(URL_!, KEY!, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } });
  }
  return client;
}

// the passphrase lives in memory (and this tab's session storage), never on the server
const PASS_KEY = "spotter-sync-pass";
let pass: string | null = null;
export function getPass(): string | null {
  if (pass) return pass;
  try {
    pass = sessionStorage.getItem(PASS_KEY);
  } catch {
    /* ignore */
  }
  return pass;
}
export function setPass(p: string | null) {
  pass = p;
  try {
    if (p) sessionStorage.setItem(PASS_KEY, p);
    else sessionStorage.removeItem(PASS_KEY);
  } catch {
    /* ignore */
  }
}

export async function getSession(): Promise<Session | null> {
  const c = await sb();
  const { data } = await c.auth.getSession();
  return data.session;
}

export async function sendLink(email: string) {
  const c = await sb();
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + "/trends?sync=1" } });
  if (error) throw error;
}

export async function signOut() {
  setPass(null);
  const c = await sb();
  await c.auth.signOut();
}

async function fetchVault(): Promise<Vault | null> {
  const c = await sb();
  const { data, error } = await c.from("vaults").select("vault").maybeSingle();
  if (error) throw error;
  return (data?.vault as Vault) ?? null;
}

async function pushVault(v: Vault) {
  const c = await sb();
  const s = await getSession();
  if (!s) throw new Error("Signed out. Sign in again to sync.");
  const { error } = await c.from("vaults").upsert({ user_id: s.user.id, vault: v, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export const hasRemote = async () => (await fetchVault()) != null;

/** Check a passphrase against the synced copy without changing anything */
export async function unlock(p: string): Promise<void> {
  const v = await fetchVault();
  if (v) await open(v, p); // throws WrongPassphrase
  setPass(p);
}

/**
 * Pull, merge, push. Returns the merged state to load locally.
 * Draws from every device survive; for settings the newer copy wins.
 */
export async function syncNow(local: State): Promise<State> {
  const p = getPass();
  if (!p) throw new Error("Enter your sync passphrase first.");
  if (local.example) throw new Error("Clear the sample first, so it doesn't end up in your synced copy.");
  const v = await fetchVault();
  const merged = v ? mergeStates(local, normalize(await open(v, p))) : local;
  await pushVault(await seal(merged, p));
  return merged;
}
