-- A single LMS (iss) may register the tool multiple times with different
-- client_id and deployment_id combinations.

-- Drop the existing primary key on lti_platforms
alter table public.lti_platforms drop constraint lti_platforms_pkey;

-- Add a deployment_id text column (nullable initially for migration safety)
alter table public.lti_platforms add column deployment_id text;

-- Create a new composite primary key on (iss, client_id, deployment_id)
alter table public.lti_platforms add primary key (iss, client_id, deployment_id);
