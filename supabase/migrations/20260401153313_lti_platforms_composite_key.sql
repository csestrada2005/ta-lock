-- Fix the lti_platforms table primary key.
-- The LTI 1.3 spec requires that a platform registration be uniquely identified
-- by the combination of iss (issuer URL) and deployment_id, not by iss alone.

-- Drop the existing primary key
alter table public.lti_platforms drop constraint lti_platforms_pkey;

-- Ensure deployment_id is not null, with an empty string as default for existing rows
update public.lti_platforms set deployment_id = '' where deployment_id is null;
alter table public.lti_platforms alter column deployment_id set not null;
alter table public.lti_platforms alter column deployment_id set default '';

-- Add a composite primary key on (iss, deployment_id)
alter table public.lti_platforms add primary key (iss, deployment_id);
