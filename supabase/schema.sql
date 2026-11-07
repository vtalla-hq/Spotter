-- Spotter accounts: one encrypted blob per user.
-- The app encrypts with the user's password before upload (AES-256-GCM,
-- PBKDF2-SHA256 600k), so this table only ever holds ciphertext.

create table if not exists public.vaults (
  user_id    uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  vault      jsonb not null,
  updated_at timestamptz not null default now(),
  -- ciphertext only: reject anything that isn't the app's vault shape
  constraint vault_shape check (vault ? 'v' and vault ? 'salt' and vault ? 'iv' and vault ? 'data'),
  constraint vault_size check (pg_column_size(vault) < 512000)
);

alter table public.vaults enable row level security;
revoke all on public.vaults from anon;

create policy "read own vault"   on public.vaults for select to authenticated using (auth.uid() = user_id);
create policy "insert own vault" on public.vaults for insert to authenticated with check (auth.uid() = user_id);
create policy "update own vault" on public.vaults for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own vault" on public.vaults for delete to authenticated using (auth.uid() = user_id);
