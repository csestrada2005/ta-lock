-- Stores the tool's public key for JWKS endpoint. Private key lives in env only.
create table if not exists public.lti_tool_keys (
  id          serial primary key,
  public_key  text not null,
  created_at  timestamptz default now() not null
);

alter table public.lti_tool_keys enable row level security;
