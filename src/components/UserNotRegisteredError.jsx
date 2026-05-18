import React from 'react';
import { base44 } from '@/api/base44Client';

const UserNotRegisteredError = () => {
  const handleLogout = () => {
    base44.auth.logout(window.location.origin);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 px-4">
      <div className="max-w-md w-full p-8 bg-slate-800/80 rounded-2xl shadow-2xl border border-slate-700">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-500/20">
            <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Account Not Found</h1>
          <p className="text-slate-300 mb-2 text-sm leading-relaxed">
            This account is not registered for Pocket Pitcher.
          </p>
          <p className="text-slate-400 mb-8 text-xs leading-relaxed">
            Please sign in with the correct account, or contact the app administrator for access.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors mb-3"
          >
            Try a Different Account
          </button>
          <p className="text-xs text-slate-500">
            This will sign you out and return you to the login screen.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;