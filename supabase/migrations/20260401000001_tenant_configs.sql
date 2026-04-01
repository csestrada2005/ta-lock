create table if not exists public.tenant_configs (
  tenant_id       text primary key,
  brand_name      text not null,
  logo_url        text not null,
  primary_color   text not null,
  secondary_color text not null,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

alter table public.tenant_configs enable row level security;
