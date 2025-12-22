# Docker Compose Separation Summary

## Changes Made

The docker-compose setup has been split into two independent stacks:

### 1. LiteLLM Stack (Root: `docker-compose.yml`)
**Location:** `/docker-compose.yml`

**Services:**
- `postgres` - PostgreSQL for LiteLLM metadata (port internal only)
- `redis` - Redis cache for LiteLLM (port internal only)
- `litellm` - LiteLLM proxy server (exposed on host port 4141)
- `nginx` - Optional Nginx HTTPS reverse proxy (ports 80, 443, 4142)

**Network:** `litellm-network`

**Start:**
```bash
docker-compose up -d                   # LiteLLM only
docker-compose up -d --build nginx     # + HTTPS proxy
```

**Access:** 
- http://localhost:4141 (LiteLLM direct)
- https://localhost:4142 (LiteLLM via TLS proxy, if enabled)

---

### 2. Chat2AnyLLM App Stack (`chat2anyllm-app/docker-compose.yml`)
**Location:** `/chat2anyllm-app/docker-compose.yml`

**Services:**
- `chat2anyllm-backend` - Node.js backend API (port 3001)
- `chat2anyllm-frontend` - React UI (port 3000)
- `chat2anyllm-postgres` - PostgreSQL for sessions/roles (dedicated instance, internal)
- `openwebui` - Optional Open WebUI interface (port 8000)

**Network:** `chat2anyllm-network` (completely separate from LiteLLM)

**Start:**
```bash
cd chat2anyllm-app
docker-compose up -d --build
```

**Access:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Open WebUI: http://localhost:8000

---

## Key Benefits

1. **Independent operation** - Start/stop each stack separately without affecting the other
2. **Separate networks** - LiteLLM stack and app stack use different Docker networks
3. **Separate databases** - Each stack has its own PostgreSQL instance
4. **No cross-dependencies** - App connects to LiteLLM via host networking (`host.docker.internal:4141`)
5. **Clean separation of concerns** - LiteLLM infrastructure vs application services
6. **Optional HTTPS proxy** - Nginx proxy in root stack can provide TLS termination for both stacks via host networking

---

## Configuration

The app backend connects to LiteLLM via environment variable:
- Default: `LITELLM_ENDPOINT=http://host.docker.internal:4141`
- Override: `LITELLM_ENDPOINT=http://custom:4141 docker-compose up -d`

---

## Files Modified

1. **`docker-compose.yml`** - Removed app services, added chat2anyllm-proxy to root stack
2. **`Dockerfile.postgres`** - Removed app DB init script (only LiteLLM init)
3. **`README.md`** - Updated Docker deployment instructions
4. **`docs/design.md`** - Updated architecture notes

## Files Created

1. **`chat2anyllm-app/docker-compose.yml`** - New app stack compose file
2. **`chat2anyllm-app/README.md`** - Documentation for app stack
3. **`nginx/default-proxy.conf`** - Nginx config for cross-network proxying (uses host.docker.internal for app services)

---

## Verification

Both compose files validate successfully:
```bash
docker-compose config          # Root stack
cd chat2anyllm-app && docker-compose config  # App stack
```
