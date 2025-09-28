# 🚀 Chat2AnyLLM: Sessions, Persistence, and Sidebar UI

Here's a practical pattern: a minimal chat UI that talks to any LLM via LiteLLM, with a secure backend proxy and a clean React front end.

---

## What It Does

- **Frontend:** Vite + React + TypeScript chat UI with streaming responses, code highlighting, theme toggle, model picker, slash commands (`/clear`, `/models`, `/model <name>`, `/roles`, `/role <name>`, `/clear_role`, `/model:plan-mode`, `/model:plan-mode-off`), Sessions sidebar, and Roles sidebar.
- **Backend:** Node/Express proxy keeps API keys server-side, exposes simple endpoints, adds Session APIs, Role APIs, persists messages in Postgres, and pipes SSE tokens to the browser.
- **LLM Layer:** LiteLLM routes requests to many providers via one API; Redis for caching; PostgreSQL for model metadata and roles storage.
- **Deployment:** Docker Compose brings up Postgres, Redis, LiteLLM, backend, and frontend. A `manage-app.sh` script is provided for local development and management.

---

## Why This Design?

- **Security by default:** Credentials live on the server, not in the browser.
- **Portability:** Add/swap models in `config.yaml` without touching the UI.
- **Ergonomics:** Streaming via SSE, sensible timeouts, and built-in fallbacks for offline dev.
- **UX resilience:** Local chat history, model discovery, slash commands, and a crisp, responsive UI.
- **Extensibility:** Roles system and Plan Mode for advanced LLM interactions.

---

## Key Flows

- **Model discovery:** Frontend → `GET /api/models` → Backend → LiteLLM `/v1/model/info`
- **Session list:** Frontend → `GET /api/sessions` → Backend → Postgres
- **Session create:** Frontend → `POST /api/sessions { title? }` → Backend → Postgres
- **Load messages:** Frontend → `GET /api/sessions/:id/messages` → Backend → Postgres
- **Chat streaming within a session:** Frontend → `POST /api/sessions/:id/chat/stream { model, message }` → Backend streams to LiteLLM `/v1/chat/completions` (SSE back to browser) and persists assistant reply to Postgres
- **Role list:** Frontend → `GET /api/roles` → Backend → Postgres
- **Role create:** Frontend → `POST /api/roles { name, instructions }` → Backend → Postgres
- **Role update:** Frontend → `PUT /api/roles/:id { name?, instructions? }` → Backend → Postgres
- **Role delete:** Frontend → `DELETE /api/roles/:id` → Backend → Postgres
- **Slash Commands:** Frontend captures user input starting with `/`, provides suggestions, and executes commands locally (e.g., clearing chat, selecting a model, managing roles).
- **Plan Mode:** Frontend → `POST /api/sessions/:id/chat/stream` with planning model → Backend → LiteLLM (plan creation) → Backend → LiteLLM (plan execution) → Response streamed back to Frontend
- **Config:** Environment variables are managed through separate `.env.*` files for each service in Docker Compose; LiteLLM wired to Redis/Postgres.

---

**Repo:** [zhujian0805/chat2anyllm](https://github.com/zhujian0805/chat2anyllm)

---

## 🗺️ Architecture Diagram

```mermaid
graph TD
    subgraph "User's Machine"
        User
    end

    subgraph "Docker Environment (docker-compose)"
        subgraph "Chat2AnyLLM Services"
            Frontend(Vite/React UI)
            Backend(Node.js Proxy)
        end

        subgraph "LiteLLM Stack"
            LiteLLM
            Redis(Redis Cache)
            Postgres(Postgres DB)
        end

        subgraph "LLM Providers"
            Providers(3rd Party LLMs)
        end

        subgraph "Optional Services"
            OpenWebUI
        end
    end

    User -- "Browser" --> Frontend
    User -- "Browser (Optional)" --> OpenWebUI

    Frontend -- "HTTP API (/api/...)" --> Backend
    Backend -- "LiteLLM API (/v1/...)" --> LiteLLM
    Backend -- "Reads/Writes for Sessions" --> Postgres
    Backend -- "Reads/Writes for Roles" --> Postgres

    LiteLLM -- "Reads/Writes" --> Redis
    LiteLLM -- "Reads/Writes" --> Postgres
    LiteLLM -- "Proxies Requests" --> Providers

    OpenWebUI -- "LiteLLM API (/v1/...)" --> LiteLLM

    style Frontend fill:#cde4ff
    style Backend fill:#cde4ff
    style LiteLLM fill:#d4edda
    style Redis fill:#d4edda
    style Postgres fill:#d4edda
    style OpenWebUI fill:#f8d7da
```

---

## Data Model (PostgreSQL)

Tables created in `scripts/init-chat2anyllm.sql` and initialized automatically by the Postgres container:

- `sessions`
    - `id UUID PK DEFAULT gen_random_uuid()`
    - `title TEXT NOT NULL DEFAULT 'New Chat'` (updated to first user message prefix)
    - `created_at TIMESTAMPTZ DEFAULT now()`
    - `updated_at TIMESTAMPTZ DEFAULT now()` (updated via triggers)

- `messages`
    - `id UUID PK DEFAULT gen_random_uuid()`
    - `session_id UUID FK → sessions(id) ON DELETE CASCADE`
    - `role TEXT CHECK IN ('user', 'assistant')`
    - `content TEXT NOT NULL`
    - `created_at TIMESTAMPTZ DEFAULT now()`

- `roles`
    - `id UUID PK DEFAULT gen_random_uuid()`
    - `name TEXT NOT NULL UNIQUE`
    - `instructions TEXT NOT NULL`
    - `created_at TIMESTAMPTZ DEFAULT now()`
    - `updated_at TIMESTAMPTZ DEFAULT now()` (updated via triggers)

Indexes & triggers:
- `idx_messages_session_created` on `(session_id, created_at)`
- Trigger updates `sessions.updated_at` on message insert.
- Trigger updates `roles.updated_at` on role update.
- `pgcrypto` extension provides `gen_random_uuid()`.

Connection string used by backend (Docker):
`DATABASE_URL=postgresql://litellm:litellm@postgres:5432/chat2anyllm`

## Backend API Additions

### Sessions API
- `GET /api/sessions` → list sessions ordered by `updated_at DESC`
- `POST /api/sessions { title? }` → create session
- `GET /api/sessions/:id/messages` → list messages for session
- `POST /api/sessions/:id/chat/stream { model, message }` →
    - inserts user message
    - streams completion from LiteLLM back to client (SSE)
    - on end, persists assistant message
    - uses the entire session history as context for the LLM
- `DELETE /api/sessions/:id` → delete session and all its messages

### Roles API
- `GET /api/roles` → list roles ordered by name
- `POST /api/roles { name, instructions }` → create role
- `PUT /api/roles/:id { name?, instructions? }` → update role
- `DELETE /api/roles/:id` → delete role

### Plan Mode API
- Plan Mode is implemented client-side but uses the same session streaming endpoint with special prompt formatting
- When Plan Mode is enabled, the client sends two requests in sequence:
  1. First to the planning model with a prompt to create a plan
  2. Second to the execution model with the plan and original question

### Slash Commands API
- `POST /slack/command` → handle Slack slash commands for roles
  - `/roles` → list all roles
  - `/role <name>` → attempt to select a role by name

Error handling: returns 4xx for bad input or 5xx for connection errors. Timeouts are set on LiteLLM calls.

## Frontend Updates

- New `SessionsSidebar` (left panel) lists sessions; click to switch.
- New `RolesSidebar` (left panel) lists roles; click to select/deselect.
- New `sessionsAPI.ts` helper for sessions CRUD and streaming chat.
- New `rolesAPI.ts` helper for roles CRUD.
- `Chat.tsx` now:
    - Loads sessions on mount; creates a new one if none exist.
    - Loads messages when active session changes.
    - Sends messages via `streamSessionChat`, appends assistant streaming message, and updates when complete.
    - `/clear` now creates a new session instead of wiping local storage.
    - Supports role selection and application to messages.
    - Implements Plan Mode with two-model workflow.
    - Shows Plan Mode indicator in header when active.

## Deployment Changes

- `scripts/init-chat2anyllm.sql`: added; copied by `Dockerfile.postgres` for auto-init.
- `backend` uses `pg` and reads `DATABASE_URL` (set in docker-compose). Depends on healthy `postgres`.
- Added roles table and triggers to database initialization script.

## New Features

### Roles System
The Roles feature allows users to define reusable role instruction prompts (system prompts) that can be injected when chatting with any LLM model. Roles are stored in PostgreSQL and can be applied to conversations to guide the LLM's behavior.

Key aspects:
- Roles are stored persistently in PostgreSQL
- Only one role can be active at a time
- Role instructions are prepended to user messages as transient system prompts
- Roles can be created, updated, and deleted via the UI
- Slash commands for listing and selecting roles

### Plan Mode
Plan Mode is a unique feature that uses two models - one for planning and one for execution. This allows for more structured and thoughtful responses.

How it works:
1. User enables Plan Mode with `/model:plan-mode <planning_model> <answering_model>`
2. When sending a message, the frontend first sends it to the planning model
3. The planning model generates a numbered checklist plan
4. The frontend then sends the original question along with the plan to the execution model
5. The execution model provides a concrete implementation following the plan

## Notes

- Frontend now persists to Postgres via backend; `localStorage` history is replaced by session storage in DB.
- Backend sets CORS, timeouts, and pipes LiteLLM's SSE stream to the client.
- LiteLLM models and headers are configured in `config.yaml`; Redis and Postgres are declared in `docker-compose.yml`.
- The `manage-app.sh` script simplifies local development by providing commands to build, start, stop, and manage the application services.
- Dockerfiles for the frontend and backend are optimized using the `node:20-bullseye-slim` base image for smaller and more efficient builds.
- Environment variables for all services are now managed through separate `.env.*` files for easier configuration management.
- Roles system provides CRUD operations through the backend API.
- Plan Mode enables more sophisticated interactions with LLMs by separating planning from execution.