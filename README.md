# TA LOCK - Professor AI (LTI 1.3 Frontend)

This repository contains the frontend application for the TA-Lock SaaS platform. It is a React-based Single Page Application (SPA) designed exclusively to function as an LTI 1.3 (Learning Tools Interoperability) External Tool. 

By utilizing the LTI 1.3 standard, this application seamlessly and securely integrates into any modern Learning Management System (LMS) such as Canvas, Moodle, or Blackboard, providing students with an immersive, full-screen AI tutoring experience.

## Architecture & Integration Flow

This application completely bypasses traditional authentication and manual course selection screens. It relies on a secure handshake with the host LMS.

1.  **The LTI Launch (`/launch`):** When a user clicks the "TA-Lock" link inside their LMS, the LMS performs a secure POST request to the application's launch route.
2.  **Context Extraction:** The application intercepts the signed JWT provided by the LMS. This token mathematically verifies the user's identity, their role (student or instructor), the specific `course_id`, and the `tenant_id` (the college).
3.  **Direct Routing (`/chat`):** Once the token is verified and the context is stored in the global state, the user is instantly redirected to the full-screen chat interface specifically configured for their current class.

## Development Setup

This project uses Bun for fast dependency management and execution.

### Prerequisites
* Bun installed on your local machine.

### Installation

1.  Clone the repository and install dependencies:
    ```bash
    bun install
    ```
2.  Start the development server:
    ```bash
    bun run dev
    ```

### Local LTI Simulation
Because the application expects to be launched by an LMS, navigating directly to `http://localhost:5173` will result in an unauthorized error. 

To simulate an LTI launch during local development, append a mock token payload to the launch URL. For example:
`http://localhost:5173/launch?token=mock_jwt_payload_here`

The local mock API service will intercept this, populate the `TenantContext`, and redirect you to the active chat interface.

## Project Structure

* `src/pages/LTILaunch.tsx` - The secure entry point. Handles parsing the LTI JWT and establishing user context.
* `src/pages/ProfessorAI.tsx` - The main application view. A full-screen layout containing the chat interface and conversation history.
* `src/components/` - Isolated UI elements, heavily utilizing shadcn/ui and Tailwind CSS.
* `src/contexts/` - Global state managers, specifically `TenantContext` which holds the active LMS configuration, course IDs, and dynamic brand theming.
* `src/services/` - API interaction layers connecting the frontend to the Professor Agent Platform backend.

## Theming and Branding

The application utilizes CSS Custom Properties to support dynamic, multi-tenant branding. Static Tailwind color utilities have been abstracted. When the application launches, it fetches the specific college's theme configuration (primary colors, secondary colors, and logos) based on the `tenant_id` and injects them into the UI at runtime.
