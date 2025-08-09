/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_ENDPOINT: string;
  readonly VITE_LITELLM_MODEL: string;
  readonly VITE_API_KEY: string;
  // Add other environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}