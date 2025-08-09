// Environment variable utilities for Vite
export const getEnvVar = (name: string, fallback?: string): string => {
  // In Vite, environment variables must be prefixed with VITE_
  const viteName = name.startsWith('VITE_') ? name : `VITE_${name}`;
  // For backward compatibility, try both the original name and the VITE_ prefixed version
  const raw = (import.meta as any).env?.[viteName] ?? (import.meta as any).env?.[name];
  const value = (raw ?? fallback) as string | undefined;
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is not defined and no fallback provided`);
  }
  return value;
};

// Specific environment variable getters
export const getBackendEndpoint = (): string => {
  // 1. Explicit override wins
  const explicit = (import.meta as any).env?.VITE_BACKEND_ENDPOINT as string | undefined
    || (import.meta as any).env?.VITE_BACKEND_ENDPOINT?.toString();
  const legacy = (import.meta as any).env?.REACT_APP_BACKEND_URL as string | undefined;
  let candidate = explicit || legacy;

  // 2. If not provided, try to infer. For non-localhost deployments we often run frontend :3000 and backend :3001 on same host.
  if (!candidate && typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    // If served from localhost dev, keep original default.
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      candidate = 'http://localhost:3001';
    } else {
      // If port is 3000 assume backend 3001, else fall back to same origin (reverse proxy / merged server scenario)
      if (port === '3000') {
        candidate = `${protocol}//${hostname}:3001`;
      } else {
        candidate = `${protocol}//${hostname}`; // same origin
      }
    }
  }

  // 3. Final fallback
  if (!candidate) candidate = 'http://localhost:3001';

  // 4. Normalize: remove trailing slash
  candidate = candidate.replace(/\/$/, '');

  // Warn if we're on a secure page but backend is insecure (mixed content risk)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && candidate.startsWith('http://')) {
    // eslint-disable-next-line no-console
    console.warn('[env] Backend endpoint is http while page is https. Consider using HTTPS for backend to avoid mixed content and credential leakage.');
  }
  return candidate;
};

export const getLiteLLMModel = (): string => {
  return getEnvVar('VITE_LITELLM_MODEL', 'gpt-3.5-turbo');
};

export const getApiKey = (): string => {
  return getEnvVar('VITE_API_KEY', '');
};