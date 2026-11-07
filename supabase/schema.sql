-- Spotter sync: one encrypted blob per user.
-- The app encrypts with the user's passphrase before upload (AES-256-GCM,
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

create policy "read own vault"   on public.vaults for select using (auth.uid() = user_id);
create policy "insert own vault" on public.vaults for insert with check (auth.uid() = user_id);
create policy "update own vault" on public.vaults for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own vault" on public.vaults for delete using (auth.uid() = user_id);
