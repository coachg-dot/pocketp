import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { setCachedUserId } from '@/lib/pitcherRepertoireStore';

// Detect Capacitor native context
const isCapacitorNative = typeof window !== 'undefined' &&
  (window.Capacitor?.isNativePlatform?.() ||
   window.location?.protocol === 'capacitor:' ||
   window.location?.protocol === 'ionic:');

// Safe return URL for auth redirects — capacitor:// is not valid for web auth flows
const getReturnUrl = () => {
  if (isCapacitorNative) {
    return typeof import.meta !== 'undefined' && import.meta.env?.VITE_BASE44_APP_BASE_URL
      ? import.meta.env.VITE_BASE44_APP_BASE_URL
      : 'https://base44.com';
  }
  return window.location.href;
};

const AuthContext = createContext();

// STARTUP_TIMEOUT: hard deadline for the entire auth check.
// Must be < 3s to satisfy Apple's launch stability requirement.
// 2500ms leaves 500ms headroom before Apple's cutoff. [v2 — capacitor-safe]
const STARTUP_TIMEOUT_MS = 2500;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // Kept for API compatibility — always resolves immediately now
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState(null);
  const didResolve = useRef(false);

  const resolveAuth = (userData, error) => {
    if (didResolve.current) return;
    didResolve.current = true;
    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
    if (userData) {
      setUser(userData);
      setIsAuthenticated(true);
      if (userData.id || userData.email) {
        setCachedUserId(userData.id || userData.email);
      }
    } else {
      setAuthError(error || { type: 'auth_required', message: 'Authentication required' });
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    // Hard-cap: no matter what, resolve after STARTUP_TIMEOUT_MS.
    // This is the last line of defense against any hang.
    const hardCap = setTimeout(() => {
      console.warn('[PP] AuthContext hard cap fired — forcing auth_required');
      resolveAuth(null, { type: 'auth_required', message: 'Startup timeout' });
    }, STARTUP_TIMEOUT_MS);

    checkAuth().finally(() => clearTimeout(hardCap));
  }, []);

  const checkAuth = async () => {
    try {
      // Inject any access_token that arrived in the URL (OAuth redirect)
      const storedToken =
        window.localStorage?.getItem('base44_access_token') ||
        window.localStorage?.getItem('base44_token');
      if (storedToken) {
        base44.auth.setToken(storedToken, false);
      }

      // Single call — base44.auth.me() uses the SDK's absolute server URL.
      // No custom axios client, no relative paths, no settings fetch.
      const currentUser = await base44.auth.me();
      resolveAuth(currentUser, null);
    } catch (error) {
      console.error('[PP] base44.auth.me() failed:', error?.status, error?.message);
      if (error?.status === 403 && error?.data?.extra_data?.reason === 'user_not_registered') {
        resolveAuth(null, { type: 'user_not_registered', message: 'User not registered' });
      } else {
        // 401, network error, timeout — always redirect to login
        resolveAuth(null, { type: 'auth_required', message: 'Authentication required' });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      base44.auth.logout(getReturnUrl());
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(getReturnUrl());
  };

  // checkAppState kept for backward compatibility with any component that calls it
  const checkAppState = async () => {
    didResolve.current = false;
    setIsLoadingAuth(true);
    await checkAuth();
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
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
