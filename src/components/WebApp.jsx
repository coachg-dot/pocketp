import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import DeleteAccount from '@/pages/DeleteAccount';
import PageNotFound from '@/lib/PageNotFound';
import { pagesConfig } from '../pages.config';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => null;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? (
    <Layout currentPageName={currentPageName}>{children}</Layout>
  ) : (
    <>{children}</>
  );

function SplashScreen({ onContinueAnyway }) {
  const [elapsed, setElapsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const steps = useMemo(() => [
    'Initializing SDK',
    'Reading stored token',
    'Calling auth.me()',
    'Initializing routes',
  ], []);

  useEffect(() => {
    console.log('[PP] Splash diagnostics mounted');

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 700);

    const timeout = setTimeout(() => {
      console.warn('[PP] Startup timed out');
      setTimedOut(true);
      clearInterval(interval);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const activeIndex = Math.min(elapsed, steps.length - 1);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#0d1a3a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, Helvetica, sans-serif',
      padding: 32,
      textAlign: 'center',
    }}>
      <svg width="80" height="80" viewBox="0 0 96 96" style={{ marginBottom: 20 }}>
        <circle cx="48" cy="48" r="44" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="3" />
        <path
          d="M26 48 Q36 36 48 34 Q60 32 70 48 Q60 64 48 62 Q36 60 26 48Z"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          opacity="0.6"
        />
        <circle cx="48" cy="48" r="6" fill="#3b82f6" />
        <text
          x="48"
          y="53"
          textAnchor="middle"
          style={{ fontSize: 14, fill: '#fff', fontWeight: 700, letterSpacing: 1 }}
        >
          PP
        </text>
      </svg>

      <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Pocket Pitcher
      </div>

      <div style={{
        width: '100%',
        maxWidth: 340,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 18,
        marginBottom: 20,
        textAlign: 'left',
      }}>
        {steps.map((step, index) => {
          const done = index < activeIndex && !timedOut;
          const active = index === activeIndex && !timedOut;

          return (
            <div
              key={step}
              style={{
                color: done ? '#4ade80' : active ? '#facc15' : '#94a3b8',
                fontSize: 14,
                marginBottom: index === steps.length - 1 ? 0 : 10,
              }}
            >
              {done ? '✓' : active ? '…' : '○'} {step}
            </div>
          );
        })}
      </div>

      {timedOut ? (
        <>
          <div style={{ color: '#facc15', fontSize: 15, marginBottom: 16 }}>
            ⚠️ Startup timed out
          </div>

          <button
            onClick={onContinueAnyway}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: '14px 28px',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Continue Anyway
          </button>
        </>
      ) : (
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'pp-spin 0.9s linear infinite',
        }} />
      )}

      <style>{`@keyframes pp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const LoginScreen = React.memo(function LoginScreen({ onLogin }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#0d1a3a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, Helvetica, sans-serif',
      padding: '32px',
      textAlign: 'center',
    }}>
      <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
        Pocket Pitcher
      </div>

      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>
        Please sign in to continue
      </div>

      <button
        onClick={onLogin}
        style={{
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: '16px 40px',
          fontSize: 17,
          fontWeight: 700,
        }}
      >
        Sign In
      </button>
    </div>
  );
});

function AuthenticatedApp() {
  const { isLoadingAuth, isAuthenticated, authError, navigateToLogin } = useAuth();
  const [continueAnyway, setContinueAnyway] = useState(false);

  const handleLogin = useCallback(() => {
    navigateToLogin();
  }, [navigateToLogin]);

  if (isLoadingAuth && !continueAnyway) {
    return <SplashScreen onContinueAnyway={() => setContinueAnyway(true)} />;
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
      <Route
        path="/"
        element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        }
      />
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

export default function WebApp() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
