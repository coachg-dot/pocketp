import React, { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { HashRouter as Router } from 'react-router-dom';

const IS_NATIVE =
  typeof window !== 'undefined' &&
  (
    typeof window.Capacitor !== 'undefined' ||
    window.Capacitor?.isNativePlatform?.() ||
    window.location?.protocol === 'capacitor:' ||
    window.location?.protocol === 'ionic:'
  );

// Web app is lazy-loaded only on web.
// This prevents AuthContext/base44Client from loading on native startup.
const WebApp = IS_NATIVE ? null : lazy(() => import('@/components/WebApp'));

const NativeLoginScreen = React.memo(function NativeLoginScreen() {
  const [signInError, setSignInError] = React.useState('');

  function handleSignIn() {
    setSignInError('');

    import('@/api/base44Client')
      .then(({ base44 }) => {
        const returnUrl = 'https://pocketpitcher26.base44.app/Home';

        try {
          base44.auth.redirectToLogin(returnUrl);
        } catch (err) {
          setSignInError(err?.message || 'Failed to open sign-in. Please try again.');
        }
      })
      .catch((err) => {
        setSignInError(err?.message || 'Failed to load sign-in. Please try again.');
      });
  }

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

      <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
        Pocket Pitcher
      </div>

      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>
        Please sign in to continue
      </div>

      <button
        onClick={handleSignIn}
        style={{
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: '16px 40px',
          fontSize: 17,
          fontWeight: 700,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        Sign In
      </button>

      {signInError ? (
        <div style={{
          marginTop: 20,
          color: '#f87171',
          fontSize: 13,
          maxWidth: 320,
          lineHeight: 1.4,
        }}>
          {signInError}
        </div>
      ) : null}
    </div>
  );
});

export default function App() {
  if (IS_NATIVE) {
    return (
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NativeLoginScreen />
        </Router>
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Suspense fallback={
          <div style={{
            minHeight: '100vh',
            background: '#0d1a3a',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            Loading...
          </div>
        }>
          <WebApp />
        </Suspense>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
