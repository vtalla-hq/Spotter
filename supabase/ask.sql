-- Spotter Ask: shared study library + daily rate limit.
-- Writes happen only from the /api/ask server function with the service key.
-- Questions are never stored.

create table if not exists public.studies (
  pmid     text primary key check (pmid ~ '^[0-9]{5,9}$'),
  title    text not null,
  journal  text,
  year     int,
  types    text[] not null default '{}',
  url      text not null,
  cited    int not null default 1,
  added_at timestamptz not null default now(),
  last_at  timestamptz not null default now()
);
alter table public.studies enable row level security;
drop policy if exists "anyone can read the library" on public.studies;
create policy "anyone can read the library" on public.studies for select to anon, authenticated using (true);

create table if not exists public.ask_usage (
  key  text not null,
  day  date not null default current_date,
  n    int  not null default 0,
  primary key (key, day)
);
alter table public.ask_usage enable row level security; -- no policies: service key only

-- Counts one use and returns today's total. The first global use of each day
-- also clears counters older than a week, so the table stays small without a cron job.
create or replace function public.ask_bump(k text) returns int
language plpgsql security definer set search_path = public as $$
declare
  total int;
begin
  insert into ask_usage (key, day, n) values (k, current_date, 1)
  on conflict (key, day) do update set n = ask_usage.n + 1
  returning n into total;
  if k = 'global' and total = 1 then
    delete from ask_usage where day < current_date - 7;
  end if;
  return total;
end;
$$;

create or replace function public.add_studies(rows jsonb) returns void
language sql security definer set search_path = public as $$
  insert into studies (pmid, title, journal, year, types, url)
  select r->>'pmid', r->>'title', r->>'journal', nullif(r->>'year','')::int,
         coalesce(array(select jsonb_array_elements_text(r->'types')), '{}'), r->>'url'
  from jsonb_array_elements(rows) r
  where r->>'pmid' ~ '^[0-9]{5,9}$'
  on conflict (pmid) do update set cited = studies.cited + 1, last_at = now();
$$;

revoke execute on function public.ask_bump(text) from public, anon, authenticated;
revoke execute on function public.add_studies(jsonb) from public, anon, authenticated;

-- the library is read on every Sources visit, ordered by citations
create index if not exists studies_cited_idx on public.studies (cited desc, last_at desc);

-- tidy old rate-limit rows (ask_bump keeps doing this daily from now on)
delete from public.ask_usage where day < current_date - 7;
