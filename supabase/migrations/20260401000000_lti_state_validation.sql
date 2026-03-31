-- This migration documents the LTI 1.3 state validation and short-lived URL launch token pattern.
-- No schema changes are needed since we are reusing the existing `lti_nonces` table.

-- The `lti_nonces` table is used for:
-- 1. Anti-replay protection for the LTI 1.3 OIDC login flow.
--    The LTI platform passes a `nonce` claim in the `id_token` during the launch request.
--    We store the nonce generated during the login initiation and consume it upon successful validation.
-- 2. CSRF protection during the LTI 1.3 OIDC login flow.
--    We generate a `state` during the login initiation and pass it to the LTI platform.
--    The LTI platform echoes it back in the launch request. We store it in `lti_nonces`
--    with a `state:` prefix and consume it upon successful validation.
-- 3. Short-lived URL launch token single-use enforcement.
--    After successfully validating the launch request, we generate a short-lived URL launch token
--    that encapsulates the session JWT and a `jti` claim. We store the `jti` in `lti_nonces`
--    and consume it upon successfully exchanging the launch token for the session token.

COMMENT ON TABLE lti_nonces IS 'Used for LTI 1.3 OIDC anti-replay (nonce), CSRF protection (state: prefix), and single-use launch tokens (jti).';
