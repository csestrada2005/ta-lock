-- Add token_endpoint for OAuth 2.0 client credentials grant to obtain AGS access tokens
alter table public.lti_platforms add column token_endpoint text;

comment on column public.lti_platforms.token_endpoint is 'The OAuth 2.0 token endpoint to obtain AGS access tokens via client credentials grant.';
