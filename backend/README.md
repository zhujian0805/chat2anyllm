# Backend Proxy Server

This Node.js backend server acts as a proxy between the frontend application and the LiteLLM endpoint. It forwards API calls to the LiteLLM service while keeping sensitive configuration on the server side.

## Features

- Proxy for LiteLLM model information endpoint
- Proxy for chat completions endpoint
- Streaming support for real-time responses
- CORS enabled for frontend communication
- Environment variable configuration

## Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables by creating a `.env` file in the backend directory with the following variables:
   ```bash
   LITELLM_ENDPOINT=http://litellm:4141
   LITELLM_API_KEY=sk-sSJygTi8yynvoE2bG8l63g
   REDIS_URL=redis://redis:6379
   PORT=3001
   ```

   Alternatively, when using Docker Compose, the environment variables are automatically loaded from the `.env.chat2anyllm-backend` file in the project root.

4. Start the server:
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## Environment Variables

- `LITELLM_ENDPOINT` - The URL of your LiteLLM service (default: http://localhost:4141)
- `LITELLM_API_KEY` - The API key for accessing LiteLLM
- `PORT` - The port for the proxy server (default: 3001)

## API Endpoints

- `GET /api/models` - Get available models from LiteLLM
- `POST /api/chat/completions` - Send chat completion requests to LiteLLM
- `POST /api/chat/completions/stream` - Send streaming chat completion requests to LiteLLM
- `GET /api/health` - Health check endpoint

## How it Works

The frontend application makes requests to this proxy server instead of directly to LiteLLM. The proxy server then forwards these requests to the actual LiteLLM endpoint, keeping sensitive configuration (like API keys) on the server side rather than exposing them to the client.