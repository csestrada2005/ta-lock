-- Add NRPS (Names and Roles Provisioning Service) columns to lti_platforms
-- nrps_context_memberships_url and access_token_url are needed for roster synchronization

alter table public.lti_platforms add column if not exists nrps_context_memberships_url text;
alter table public.lti_platforms add column if not exists access_token_url text;
