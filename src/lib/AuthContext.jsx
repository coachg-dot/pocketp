import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { setCachedUserId } from '@/lib/pitcherRepertoireStore';

// ─── Native detection — evaluated synchronously at module load time ───────────
// window.Capacitor is injected by the Capacitor bridge before any JS runs.
// Checking typeof (not optional chaining) catches it even before plugins init.
const isCapacitorNative =
  typeof window !== 'undefined' &&
  (
    typeof window.Capacitor !== 'undefined' ||
    window.Capacitor?.isNativePlatform?.() ||
    window.location?.protocol === 'capacitor:' ||
    window.location?.protocol === 'ionic:'
  );

console.log('[PP] isCapacitorNative =', isCapacitorNative, '| protocol =', typeof window !== 'undefined' ? window.location?.protocol : 'N/A');

// Safe return URL — capacitor:// is rejected by the auth server
const getReturnUrl = () => {
  if (isCapacitorNative) {
    return import.meta.env?.VITE_BASE44_APP_BASE_URL || 'https://base44.com';
  }
  return window.location.href;
};

const AuthContext = createContext(null);

// 1500 ms hard cap for web — if auth.me() hangs, fail open to login screen
const STARTUP_TIMEOUT_MS = 1500;

export const AuthProvider = ({ children }) => {
  // ─── CRITICAL: On native, start with isLoadingAuth=false immediately ─────
  // If we start as true and flip in useEffect, the first render shows the
  // splash/auth-check screen — that IS the flash loop. Starting false means
  // the very first render on native goes straight to the login screen.
  const [user,            setUser           ] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth,   setIsLoadingAuth  ] = useState(!isCapacitorNative);
  const [authError,       setAuthError      ] = useState(null);

  // API-compat stubs
  const [isLoadingPublicSettings] = useState(false);
  const [appPublicSettings]       = useState(null);

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

  // ─── Web-only startup auth check ─────────────────────────────────────────
  // On native: zero useEffects, zero API calls, zero state mutations after mount.
  // Initial state (isLoadingAuth=false, isAuthenticated=false, user=null) is the
  // final state — identical to FakeAuthProvider. Nothing runs until user taps Sign In.
  useEffect(() => {
    if (isCapacitorNative) return; // ← native: hard stop, no side-effects

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

  // Only called when the USER taps "Sign In" — NEVER called automatically
  const navigateToLogin = () => {
    base44.auth.redirectToLogin(getReturnUrl());
  };

  // Manual re-check (e.g. after returning from OAuth) — web only
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
