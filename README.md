# React Chat App with LiteLLM Integration

A modern, Apple-style chat application built with React and TypeScript that integrates with LiteLLM endpoints. Features include dark/light theme switching, code syntax highlighting, and a clean, responsive interface.

For a detailed explanation of the architecture and design decisions, please see the [Design Document](docs/design.md).

## Features

- 🎨 **Modern Apple-style UI** - Clean, minimalist design with smooth animations
- 🌙 **Dark/Light Theme** - Toggle between themes with persistent preferences
- 💬 **Real-time Chat** - Send messages to any LiteLLM-compatible endpoint
- ✨ **Slash Commands** - Use `/clear`, `/models`, `/model <name>`, `/roles`, `/role <name>`, and `/clear_role` for quick actions.
- 🎨 **Code Highlighting** - Automatic syntax highlighting for code blocks in responses
- 📱 **Responsive Design** - Works on desktop and mobile devices
- ⚡ **Fast & Lightweight** - Built with modern React and TypeScript
- 🔒 **Secure Backend Proxy** - Node.js backend proxy for secure API communication
- 🗂️ **Session Management** - Persistent chat sessions stored in PostgreSQL
- 👥 **Roles System** - Create and apply reusable role instructions to guide LLM behavior
- 📋 **Plan Mode** - Use two models: one for planning and one for execution
- 🔄 **Model Selection** - Choose from available LiteLLM models for each conversation

## Architecture

This application uses a secure architecture with a backend proxy. Here is a diagram of the architecture:

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

This architecture keeps sensitive API keys and configuration on the server side, providing better security than direct client-client connections to LiteLLM.

## Screenshots

*A screenshot of the application will be added here soon.*

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Docker and Docker Compose (for containerized deployment)
- A running LiteLLM server or compatible API endpoint

## Configuration

Environment variables are now managed through separate `.env.*` files for each service:

### LiteLLM Service (.env.litellm)
```bash
LITELLM_MASTER_KEY=sk-1234
LITELLM_SALT_KEY=sk-1234
DATABASE_URL=postgres://litellm:litellm@postgres/litellm
STORE_MODEL_IN_DB=True
PORT=4141
```

### PostgreSQL Service (.env.postgres)
```bash
POSTGRES_DB=litellm
POSTGRES_USER=litellm
POSTGRES_PASSWORD=litellm
```

### Frontend Service (.env.chat2anyllm-frontend)
```bash
# Vite requires VITE_ prefix
VITE_BACKEND_ENDPOINT=http://chat2anyllm-backend:3001
VITE_LITELLM_MODEL=gpt-3.5-turbo
VITE_API_KEY=
```

### Backend Service (.env.chat2anyllm-backend)
```bash
LITELLM_ENDPOINT=http://litellm:4141
LITELLM_API_KEY=sk-sSJygTi8yynvoE2bG8l63g
PORT=3001
DATABASE_URL=postgres://litellm:litellm@postgres/litellm
JWT_SECRET=please-change
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SLACK_SIGNING_SECRET=your-slack-signing-secret-here
```

### LiteLLM Setup

If you don't have LiteLLM running, you can set it up using Docker Compose:

```bash
# Start LiteLLM stack (PostgreSQL, Redis, LiteLLM, optional Nginx proxy)
docker-compose up -d

# Optional: Start with HTTPS proxy
docker-compose up -d --build nginx
```

The LiteLLM configuration is stored in `config.yaml` and the database initialization script is in `scripts/init-litellm.sql`.

## Application Management

Use the `manage-app.sh` script to easily build, start, stop, and manage both frontend and backend services:

```bash
# Build the frontend application
./manage-app.sh build

# Start both services
./manage-app.sh start

# Check status
./manage-app.sh status

# Stop both services
./manage-app.sh stop

# Restart everything
./manage-app.sh restart

# Start only the frontend
./manage-app.sh start-frontend

# Stop only the backend
./manage-app.sh stop-backend
```

Service Details:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Backend API Health Check: http://localhost:3001/api/health

Authentication:
- Use the Login button in the UI to obtain a JWT (demo accepts any non-empty username/password).
- Protected resources: /api/sessions and /api/roles require the Authorization: Bearer <token> header.

For more details, see [BUILD_SCRIPT_README.md](BUILD_SCRIPT_README.md).

## Docker Deployment

For containerized deployment, use Docker Compose:

```bash
# Start LiteLLM stack (root)
docker-compose up -d

# Start Chat2AnyLLM app stack (frontend/backend/openwebui + app postgres)
docker-compose -f chat2anyllm-app/docker-compose.yml up -d --build

# Optional: Start HTTPS proxy (exposes app + litellm via https)
docker-compose up -d --build nginx
```

Services will be available at:
- LiteLLM Proxy: http://localhost:4141
- Chat2AnyLLM Frontend: http://localhost:3000
- Chat2AnyLLM Backend: http://localhost:3001
- Open WebUI (optional): http://localhost:8000

With HTTPS proxy enabled:
- Frontend + Backend: https://localhost/
- LiteLLM via proxy: https://localhost/litellm/
- LiteLLM dedicated TLS: https://localhost:4142/

Note: the app stack talks to LiteLLM via `http://host.docker.internal:4141` by default; override with `LITELLM_ENDPOINT=...` when running compose if needed.

Generate self-signed certs for HTTPS proxy:
```bash
scripts/generate-self-signed-cert.sh
```

## New Features

### Roles System
The Roles feature allows you to create reusable role instruction prompts (system prompts) that can be injected when chatting with any LLM model. Roles are stored in PostgreSQL and can be applied to conversations to guide the LLM's behavior.

To use roles:
1. Click the "Roles" section in the left sidebar
2. Click "+New" to create a role by entering a name and its instructions
3. Click on a role to make it active
4. When a role is active, its instructions are prepended to your messages
5. Click the active role again to clear it

Slash commands for roles:
- `/roles` - List all available roles
- `/role <name>` - Select a role by name
- `/clear_role` - Clear the active role

### Plan Mode
Plan Mode is a unique feature that uses two models - one for planning and one for execution. This allows for more structured and thoughtful responses.

To enable Plan Mode:
1. Use the slash command: `/model:plan-mode <planning_model> <answering_model>`
2. Example: `/model:plan-mode gpt-4 claude-3`
3. To disable: `/model:plan-mode-off`

When Plan Mode is enabled:
1. The first model creates a plan as a numbered checklist
2. The second model executes the plan and provides a concrete implementation

### Session Management
The application now supports persistent chat sessions stored in PostgreSQL. You can:
- Create new sessions
- Switch between existing sessions
- Delete sessions
- Sessions are automatically titled based on the first message

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).