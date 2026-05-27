import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import DeleteAccount from './pages/DeleteAccount';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// Deferred redirect component — avoids calling navigateToLogin() synchronously
// during render. On mobile, after Google OAuth redirect, the token is written
// to localStorage by app-params.js on the same tick as the first render.
// Calling navigateToLogin() synchronously would fire BEFORE the token is stored,
// wiping the session and causing an infinite login loop on mobile.
function AuthRedirect({ navigateToLogin }) {
  useEffect(() => {
    // Small delay to allow app-params.js to finish writing the access_token
    // from the URL to localStorage before we decide auth has truly failed.
    const timer = setTimeout(() => {
      navigateToLogin();
    }, 300);
    return () => clearTimeout(timer);
  }, [navigateToLogin]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Use a component so we can use useEffect — avoids calling navigateToLogin()
      // synchronously during render, which causes a mobile redirect loop when the
      // OAuth token hasn't been fully stored yet on the first render after redirect.
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
