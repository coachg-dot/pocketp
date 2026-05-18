import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

// IMPORTANT: Do NOT pass token here. The SDK reads its own stored token from localStorage
// automatically on every request. Passing appParams.token (captured once at module load)
// can result in a stale null token being sent, overwriting the SDK's valid stored token.
// If a fresh access_token arrived in the URL, appParams.token will have it and we pass it
// so the SDK can store it; otherwise we omit it entirely.
export const base44 = createClient({
  appId: appParams.appId,
  ...(appParams.token ? { token: appParams.token } : {}),
  functionsVersion: appParams.functionsVersion,
  serverUrl: '',
  requiresAuth: true,
  appBaseUrl: appParams.appBaseUrl,
});