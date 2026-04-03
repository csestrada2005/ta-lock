# TA LOCK - Professor AI (LTI 1.3 External Tool)

This repository contains the full-stack application for the TaLock platform. It is a multi-tenant AI tutoring SaaS designed to function as an LTI 1.3 (Learning Tools Interoperability) External Tool, embedding securely within modern LMS platforms like Canvas.

## Architecture & Integration Flow

TaLock uses an LTI 1.3 integration. The flow is as follows:

1. **OIDC Initiation (`/lti-oidc-init`):**
   Canvas triggers the OIDC login initiation by sending a POST to the `lti-oidc-init` Edge Function. The function validates the platform, generates cryptographically bound state and nonce parameters, and redirects the user back to the Canvas authorization endpoint.

2. **LTI Launch (`/lti-launch`):**
   Canvas POSTs a signed `id_token` to the `lti-launch` Edge Function. The function validates the state and nonce binding to prevent CSRF, verifies the RS256 signature against cached JWKS, validates all standard claims (exp, nbf, aud), and checks for anti-replay. It then mints an 8-hour internal session JWT and a short-lived, 5-minute single-use launch token. Finally, it redirects the client to the frontend (`/launch?lt=<token>` or `/deep-link?lt=<token>`).

3. **Session Exchange & Routing:**
   - **Student / Chat (`/launch`):** The frontend exchanges the launch token via a POST to the `lti-session/exchange` Edge Function, stores the resulting session token in `sessionStorage`, and navigates the user to the `/chat` route.
   - **Instructor / Deep Linking (`/deep-link`):** Instructors exchanging a deep link token are presented with a branding configuration UI. After saving, the settings are submitted via the `lti-deep-link-response` Edge Function back to Canvas.

## Local Development

The legacy mock token URL pattern is deprecated. To test locally, you must use a real LTI 1.3 test platform, or utilize an LTI debug tool such as `ltijs-demo` or the IMS Reference Implementation.

## Project Structure

The project is structured into backend edge functions, database migrations, and the frontend React application:

- `supabase/functions/`: Supabase Edge Functions (e.g., `lti-oidc-init`, `lti-launch`, `lti-session`, `lti-deep-link-response`, `lti-ags-submit`)
- `supabase/migrations/`: Postgres database schemas
- `src/pages/`: Main application routes (`LTILaunch`, `DeepLink`, `ProfessorAI`, `Unauthorized`)
- `src/contexts/TaLockContext.tsx`: Global state for sessions, authorization, and multi-tenant theming
- `src/hooks/useProfessorChat.ts`: Chat logic hook
- `src/types/global.d.ts`: TypeScript definitions (e.g., `TaLockConfig`)

## Prerequisites and Setup

1. **Tools:**
   - Bun (package manager and script runner)
   - Supabase CLI

2. **Environment Variables:**
   Ensure the following environment variables are set for the edge functions and frontend:
   - `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TALOCK_JWT_SECRET`
   - `TALOCK_PRIVATE_KEY`
   - `LTI_CLIENT_ID`
   - `FRONTEND_URL`
   - `ALLOWED_ORIGIN`

3. **Installation & Running:**
   ```bash
   bun install
   bun run dev
   ```
