-- Documenting the LTI state and nonce binding key conventions.
-- No schema changes required for the lti_nonces table.

/*
  The `lti_nonces` table stores short-lived nonces to prevent replay attacks and
  state values to prevent CSRF attacks during the LTI 1.3 OIDC login flow.

  To cryptographically bind the OIDC state parameter to the id_token nonce claim,
  the `lti-oidc-init` function now inserts:
    1. A bound state key: `state:${state}:nonce:${nonce}`
    2. A plain nonce key for anti-replay: `nonce:${nonce}`

  The `lti-launch` function now:
    1. Extracts both `state` (from POST body) and `nonce` (from the decoded JWT).
    2. Validates the CSRF state by looking up `state:${state}:nonce:${nonce}`.
    3. Validates the anti-replay nonce by looking up `nonce:${nonce}`.
*/
