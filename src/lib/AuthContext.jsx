import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { setCachedUserId } from '@/lib/pitcherRepertoireStore';

// Detect Capacitor native context — evaluated once at module load time
const isCapacitorNative =
  typeof window !== 'undefined' &&
  (window.Capacitor?.isNativePlatform?.() ||
   window.location?.protocol === 'capacitor:' ||
   window.location?.protocol === 'ionic:');

// Safe return URL — capacitor:// is rejected by the auth server
const getReturnUrl = () => {
  if (isCapacitorNative) {
    return import.meta.env?.VITE_BASE44_APP_BASE_URL || 'https://base44.com';
  }
  return window.location.href;
};

const AuthContext = createContext(null);

// 1500 ms hard cap — if auth.me() hangs, fail open to login screen
const STARTUP_TIMEOUT_MS = 1500;

export const AuthProvider = ({ children }) => {
  const [user,            setUser           ] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth,   setIsLoadingAuth  ] = useState(true);
  const [authError,       setAuthError      ] = useState(null);

  // API-compat stubs (always-resolved, nothing fetches settings any more)
  const [isLoadingPublicSettings] = useState(false);
  const [appPublicSettings]       = useState(null);

  // didRun — ensures the startup auth check fires exactly once,
  // even under React StrictMode double-invocation
  const didRun = useRef(false);

  const resolveAuth = (userData, error) => {
    setIsLoadingAuth(false);
    if (userData) {
      setUser(userData);
      setIsAuthenticated(true);
      setCachedUserId(userData.id || userData.email || '');
    } else {
      setAuthError(error || { type: 'auth_required', message: 'Authentication required' });
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    // Strict guard — runs exactly once per app lifetime.
    if (didRun.current) return;
    didRun.current = true;

    // ─── NATIVE iOS / Capacitor ───────────────────────────────────────────────
    // base44.auth.me() hangs indefinitely in the Capacitor WebView during cold
    // launch — the SDK makes an HTTPS request that never resolves before iOS
    // kills the launch watchdog. Skip it entirely and go straight to login.
    // The user will tap "Sign In" to start the OAuth flow manually.
    if (isCapacitorNative) {
      console.log('[PP] Native launch — skipping auth.me(), showing login immediately');
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setUser(null);
      // null authError = show login screen (not an error state, just logged-out)
      return;
    }

    // ─── Web browser ─────────────────────────────────────────────────────────
    console.log('[PP] Web launch — running auth check');

    let resolved = false;
    const hardCap = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.warn('[PP] Auth hard cap fired — showing login');
      resolveAuth(null, { type: 'auth_required', message: 'Startup timeout' });
    }, STARTUP_TIMEOUT_MS);

    (async () => {
      try {
        const storedToken =
          window.localStorage?.getItem('base44_access_token') ||
          window.localStorage?.getItem('base44_token');
        if (storedToken) {
          base44.auth.setToken(storedToken, false);
        }
        const currentUser = await base44.auth.me();
        if (resolved) return;
        resolved = true;
        clearTimeout(hardCap);
        resolveAuth(currentUser, null);
      } catch (err) {
        if (resolved) return;
        resolved = true;
        clearTimeout(hardCap);
        if (err?.status === 403 &&
            err?.data?.extra_data?.reason === 'user_not_registered') {
          resolveAuth(null, { type: 'user_not_registered', message: 'User not registered' });
        } else {
          resolveAuth(null, { type: 'auth_required', message: 'Authentication required' });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      base44.auth.logout(getReturnUrl());
    } else {
      base44.auth.logout();
    }
  };

  // Only called when the USER taps "Sign In" — never called automatically
  const navigateToLogin = () => {
    base44.auth.redirectToLogin(getReturnUrl());
  };

  // Manual re-check (e.g. after returning from OAuth) — does NOT restart the hard cap
  const checkAppState = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await base44.auth.me();
      resolveAuth(currentUser, null);
    } catch {
      resolveAuth(null, { type: 'auth_required', message: 'Authentication required' });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
