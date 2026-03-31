-- LTI 1.3 platform registry: one row per known LMS
create table if not exists public.lti_platforms (
  iss         text primary key,
  client_id   text not null,
  auth_endpoint text not null,
  jwks_uri    text not null,
  tenant_id   text not null
);

-- LTI 1.3 nonces: prevents replay attacks, TTL-ed via expires_at
create table if not exists public.lti_nonces (
  nonce      text primary key,
  expires_at timestamptz not null
);

-- Only the service role (Edge Functions) should touch these tables.
alter table public.lti_platforms enable row level security;
alter table public.lti_nonces     enable row level security;

-- No public access policies — service role bypasses RLS automatically.
