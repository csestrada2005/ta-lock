create table if not exists public.jwks_cache (
  jwks_uri    text primary key,
  jwks_json   jsonb not null,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.jwks_cache enable row level security;
-- No public policies; service role only.
