import React, { useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { pagesConfig } from './pages.config';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import DeleteAccount from './pages/DeleteAccount';

// ─── Page config ───────────────────────────────────────────────────────────────
const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => null;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout
    ? <Layout currentPageName={currentPageName}>{children}</Layout>
    : <>{children}</>;

// ─── Native detection ─────────────────────────────────────────────────────────
const IS_NATIVE =
  typeof window !== 'undefined' &&
  (
    typeof window.Capacitor !== 'undefined' ||
    window.Capacitor?.isNativePlatform?.() ||
    window.location?.protocol === 'capacitor:' ||
    window.location?.protocol === 'ionic:'
  );

// ─── Login screen — static, memo'd, never auto-redirects ──────────────────────
// Must remain completely inert until the user taps the button.
// No useEffect, no setTimeout, no automatic calls to onLogin.
const LoginScreen = React.memo(function LoginScreen({ onLogin }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#0d1a3a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, Helvetica, sans-serif',
      padding: '32px', textAlign: 'center',
    }}>
      <svg width="80" height="80" viewBox="0 0 96 96" style={{ marginBottom: 20 }}>
        <circle cx="48" cy="48" r="44" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="3"/>
        <path d="M26 48 Q36 36 48 34 Q60 32 70 48 Q60 64 48 62 Q36 60 26 48Z"
          fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.6"/>
        <circle cx="48" cy="48" r="6" fill="#3b82f6"/>
        <text x="48" y="53" textAnchor="middle"
          style={{ fontSize: 14, fill: '#fff', fontWeight: 700, letterSpacing: 1 }}>PP</text>
      </svg>
      <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
        Pocket Pitcher
      </div>
      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>
        Please sign in to continue
      </div>
      <button
        onClick={onLogin}
        style={{
          background: '#3b82f6', color: '#fff', border: 'none',
          borderRadius: 14, padding: '16px 40px',
          fontSize: 17, fontWeight: 700, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        Sign In
      </button>
    </div>
  );
});

// ─── Splash screen ─────────────────────────────────────────────────────────────
function SplashScreen({ phase }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#0d1a3a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, Helvetica, sans-serif',
    }}>
      <svg width="80" height="80" viewBox="0 0 96 96" style={{ marginBottom: 20 }}>
        <circle cx="48" cy="48" r="44" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="3"/>
        <path d="M26 48 Q36 36 48 34 Q60 32 70 48 Q60 64 48 62 Q36 60 26 48Z"
          fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.6"/>
        <circle cx="48" cy="48" r="6" fill="#3b82f6"/>
        <text x="48" y="53" textAnchor="middle"
          style={{ fontSize: 14, fill: '#fff', fontWeight: 700, letterSpacing: 1 }}>PP</text>
      </svg>
      <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Pocket Pitcher
      </div>
      <div style={{ color: '#60a5fa', fontSize: 13, marginBottom: 24, opacity: 0.8 }}>
        {phase || 'Loading...'}
      </div>
      <div style={{
        width: 32, height: 32,
        border: '3px solid rgba(255,255,255,0.15)',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'pp-spin 0.9s linear infinite',
      }} />
      <style>{`@keyframes pp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Authenticated app shell ───────────────────────────────────────────────────
function AuthenticatedApp() {
  const { isLoadingAuth, isAuthenticated, authError, navigateToLogin } = useAuth();

  // Stable callback — never changes identity, safe to pass to memo'd LoginScreen
  const handleLogin = useCallback(() => {
    navigateToLogin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoadingAuth) {
    return <SplashScreen phase="Authenticating..." />;
  }

  if (!isAuthenticated) {
    if (authError?.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return (
      <Routes>
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="*" element={<LoginScreen onLogin={handleLogin} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
