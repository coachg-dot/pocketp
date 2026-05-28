import React, { useEffect, useRef, useState } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
// HashRouter — required for Capacitor iOS WebView.
// BrowserRouter breaks on native because capacitor://localhost/<path> has no server.
import { HashRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
// AuthProvider is mounted OUTSIDE AppRouter so that hash-route changes
// (useLocation) never unmount/remount AuthProvider and never re-trigger auth checks.
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import DeleteAccount from './pages/DeleteAccount';

// ─── Native detection (module-level, evaluated once) ─────────────────────────
// Cast a wide net — matches AuthContext.jsx detection exactly.
const IS_NATIVE =
  typeof window !== 'undefined' &&
  (
    typeof window.Capacitor !== 'undefined' ||
    window.Capacitor?.isNativePlatform?.() === true ||
    window.location?.protocol === 'capacitor:' ||
    window.location?.protocol === 'ionic:'
  );

// ─── Native diagnostic overlay ────────────────────────────────────────────────
// Visible for 15s on native builds so you can read it on the physical device.
// Shows every auth state change so we can identify the flash-loop trigger.
function NativeDiagOverlay() {
  const [lines, setLines] = useState(['[0ms] APP MOUNTED']);
  const [visible, setVisible] = useState(true);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!IS_NATIVE) return;
    // Intercept console.log/warn so we capture all [PP] messages
    const origLog  = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const push = (msg) => {
      const ms = Date.now() - startRef.current;
      setLines(prev => [...prev.slice(-12), `[${ms}ms] ${msg}`]);
    };
    console.log  = (...args) => { origLog(...args);  const s = args.join(' '); if (s.includes('[PP]')) push(s.replace('[PP] ', '')); };
    console.warn = (...args) => { origWarn(...args); const s = args.join(' '); if (s.includes('[PP]')) push('⚠ ' + s.replace('[PP] ', '')); };
    const timer = setTimeout(() => setVisible(false), 15000);
    return () => {
      console.log  = origLog;
      console.warn = origWarn;
      clearTimeout(timer);
    };
  }, []);

  if (!IS_NATIVE || !visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99998,
      background: 'rgba(0,0,0,0.85)', padding: '8px 12px',
      fontFamily: 'monospace', fontSize: 11, color: '#4ade80',
      pointerEvents: 'none',
    }}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
      <div style={{ color: '#94a3b8', marginTop: 4 }}>
        (overlay hides after 15s — tap nothing, just read)
      </div>
    </div>
  );
}

// ─── Static login screen ───────────────────────────────────────────────────────
// Shown when auth times out or returns no session.
// NEVER calls navigateToLogin() automatically — auto-redirect causes
// URL change → HashRouter re-renders AppRouter → AuthProvider remounts → loop.
function LoginScreen({ phase, onLogin }) {
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
        {phase || 'Please sign in to continue'}
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
}

// ─── Branded splash / diagnostics screen ──────────────────────────────────────
function SplashScreen({ phase, diagnostics }) {
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

      {diagnostics && diagnostics.length > 0 && (
        <div style={{
          marginBottom: 24,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10, padding: '10px 20px', minWidth: 220,
        }}>
          {diagnostics.map((d, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '3px 0', fontSize: 12,
              color: d.ok === true ? '#4ade80' : d.ok === false ? '#f87171' : '#94a3b8',
            }}>
              <span style={{ fontSize: 14 }}>
                {d.ok === true ? '✓' : d.ok === false ? '✗' : '…'}
              </span>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      )}

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

// ─── Page config ───────────────────────────────────────────────────────────────
const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => null;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout
    ? <Layout currentPageName={currentPageName}>{children}</Layout>
    : <>{children}</>;

// ─── Authenticated app shell ───────────────────────────────────────────────────
// Reads auth state but NEVER modifies it — only AuthContext startup logic does that.
const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, authError, navigateToLogin } = useAuth();

  // Diagnostic: log every render so we can see in TestFlight console if something
  // causes this component to remount after the main screen appears.
  const renderCount = React.useRef(0);
  renderCount.current += 1;
  if (renderCount.current === 1) {
    console.log('[PP] AuthenticatedApp MOUNTED (render #1)');
  } else {
    console.log('[PP] AuthenticatedApp RE-RENDER #' + renderCount.current +
      ' isLoadingAuth=' + isLoadingAuth + ' isAuthenticated=' + isAuthenticated);
  }

  const isNative = IS_NATIVE;

  const diagnostics = isNative
    ? [
        { label: 'APP STARTED',            ok: true },
        { label: 'ROUTER READY',           ok: true },
        { label: 'SETTINGS',               ok: true },
        { label: 'AUTH SKIPPED FOR NATIVE', ok: true },
        { label: 'SHOWING APP',            ok: true },
      ]
    : [
        { label: 'APP STARTED',  ok: true },
        { label: 'ROUTER READY', ok: true },
        { label: 'SETTINGS',     ok: true },
        { label: 'AUTH CHECK',   ok: isLoadingAuth ? null : (authError ? false : true) },
      ];

  if (isLoadingAuth) {
    console.log('[PP] SHOWING SPLASH — isLoadingAuth=true');
    return <SplashScreen phase="Authenticating..." diagnostics={diagnostics} />;
  }

  // Not authenticated — show stable login screen (no redirect, no retry)
  if (!isAuthenticated) {
    console.log('[PP] NOT AUTHENTICATED — showing login screen');
    if (authError?.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    const phase = isNative
      ? 'Sign in to use Pocket Pitcher'
      : (authError?.message === 'Startup timeout'
          ? 'Auth timeout — showing login'
          : 'Please sign in to continue');
    // /delete-account is always public even when logged out
    return (
      <Routes>
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="*" element={<LoginScreen phase={phase} onLogin={navigateToLogin} />} />
      </Routes>
    );
  }

  console.log('[PP] AUTHENTICATED — rendering app routes');
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
};

// ─── AppRouter ─────────────────────────────────────────────────────────────────
// useLocation() lives here — route changes re-render AppRouter but AuthProvider
// is mounted ABOVE this component in App(), so it is never affected.
//
// CRITICAL: Do NOT conditionally return different component trees from AppRouter
// based on pathname BEFORE the Routes component renders — that would unmount
// AuthenticatedApp and remount it, re-triggering the flash loop.
// Instead, the /delete-account special case is handled as a top-level Route.
function AppRouter() {
  return <AuthenticatedApp />;
}

// ─── Root ──────────────────────────────────────────────────────────────────────
// Mounting order (outermost → innermost):
//   QueryClientProvider
//     Router (HashRouter)
//       AuthProvider   ← mounted once, never remounted by route changes
//         AppRouter    ← re-renders on location change, does NOT remount AuthProvider
//           AuthenticatedApp
function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <NativeDiagOverlay />
      <Router>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
