import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
// CRITICAL: HashRouter instead of BrowserRouter for Capacitor iOS WebView.
// BrowserRouter requires a real HTTP server for route resolution — in the native
// WebView (capacitor://localhost/) any non-root path returns a blank page.
// HashRouter uses the URL hash (#/path) which always resolves to the bundled index.html.
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import DeleteAccount from './pages/DeleteAccount';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// Deferred redirect component — shows a branded splash immediately (never blank),
// then redirects after a short delay to allow app-params.js to finish writing
// the access_token from the URL before we decide auth has truly failed.
function AuthRedirect({ navigateToLogin }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigateToLogin();
    }, 500);
    return () => clearTimeout(timer);
  }, [navigateToLogin]);

  return <SplashScreen phase="Redirecting to login..." />;
}

// Branded splash — inline CSS only, no remote assets, no Tailwind, no auth deps.
// Renders instantly inside Capacitor iOS WebView on cold launch.
// `phase` = current status string shown below the title.
// `diagnostics` = optional array of {label, ok} stage entries for native debug builds.
function SplashScreen({ phase, diagnostics }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: '#0d1a3a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, Helvetica, sans-serif',
    }}>
      {/* SVG baseball icon — no remote asset dependency */}
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

      {/* Startup diagnostics — always visible so native hangs are immediately apparent */}
      {diagnostics && diagnostics.length > 0 && (
        <div style={{
          marginBottom: 24,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10,
          padding: '10px 20px',
          minWidth: 220,
        }}>
          {diagnostics.map((d, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '3px 0',
              fontSize: 12,
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

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Build live diagnostic stages for the splash screen
  // so any hang is immediately visible on a real device
  const diagnostics = [
    { label: 'APP STARTED',    ok: true },
    { label: 'ROUTER READY',   ok: true },
    { label: 'SETTINGS',       ok: isLoadingPublicSettings ? null : true },
    { label: 'AUTH CHECK',     ok: isLoadingAuth ? null : (authError ? false : true) },
  ];

  // Show branded splash while auth initializes
  if (isLoadingAuth) {
    return <SplashScreen phase="Authenticating..." diagnostics={diagnostics} />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else {
      // auth_required or any error → redirect to login, never blank screen
      return <AuthRedirect navigateToLogin={navigateToLogin} />;
    }
  }

  // Render the main app
  return (
    <Routes>
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


function AppRouter() {
  const location = useLocation();
  // Public routes that bypass auth entirely
  if (location.pathname === '/delete-account') {
    return <DeleteAccount />;
  }
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AppRouter />
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
