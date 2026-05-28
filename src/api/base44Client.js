import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

// CAPACITOR NOTE: serverUrl must be an absolute https URL. [v2 — capacitor-safe]
// An empty string or relative path resolves to capacitor://localhost/...
// which is a dead protocol in the native WebView — all API calls silently fail.
// The SDK uses VITE_BASE44_APP_BASE_URL (injected at build time) as its server root.
// We never pass `token` from appParams here unless a fresh one arrived via URL redirect,
// because a stale null value would overwrite the SDK's valid stored token.
export const base44 = createClient({
  appId: appParams.appId,
  ...(appParams.token ? { token: appParams.token } : {}),
  functionsVersion: appParams.functionsVersion,
  // DO NOT pass serverUrl: '' — let the SDK use its built-in absolute base URL.
  // Passing empty string forces relative paths which break in Capacitor native WebView.
  requiresAuth: true,
  appBaseUrl: appParams.appBaseUrl,
});
