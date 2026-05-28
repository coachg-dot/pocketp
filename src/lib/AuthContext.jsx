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
    // Strict guard — runs once per app lifetime, never on re-render or route change.
    // AuthProvider must be mounted ABOVE the router so location changes cannot
    // unmount/remount it (which would re-trigger this effect and cause a flash loop).
    if (didRun.current) return;
    didRun.current = true;

    console.log('[PP] AuthContext: starting auth check (cap=' + STARTUP_TIMEOUT_MS + 'ms)');

    // Hard timeout — fires if auth.me() never resolves (common in Capacitor WebView
    // when no network or the SDK hangs on capacitor:// protocol resolution)
    let resolved = false;
    const hardCap = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.warn('[PP] Auth hard cap fired — showing login');
      resolveAuth(null, { type: 'auth_required', message: 'Startup timeout' });
    }, STARTUP_TIMEOUT_MS);

    (async () => {
      try {
        // Restore token written by the OAuth redirect handler
        const storedToken =
          window.localStorage?.getItem('base44_access_token') ||
          window.localStorage?.getItem('base44_token');
        if (storedToken) {
          base44.auth.setToken(storedToken, false);
        }

        const currentUser = await base44.auth.me();
        if (resolved) return; // hard cap already fired
        resolved = true;
        clearTimeout(hardCap);
        console.log('[PP] auth.me() succeeded:', currentUser?.email);
        resolveAuth(currentUser, null);
      } catch (err) {
        if (resolved) return;
        resolved = true;
        clearTimeout(hardCap);
        console.warn('[PP] auth.me() failed:', err?.status, err?.message);
        if (err?.status === 403 &&
            err?.data?.extra_data?.reason === 'user_not_registered') {
          resolveAuth(null, { type: 'user_not_registered', message: 'User not registered' });
        } else {
          resolveAuth(null, { type: 'auth_required', message: 'Authentication required' });
        }
      }
    })();

    // No cleanup needed — hardCap is cleared inside the async fn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty: runs once on mount, never re-runs

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
