import React, { createContext, useContext } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from './lib/query-client';
import { HashRouter, Routes, Route } from 'react-router-dom';

const AuthContext = createContext();

function FakeAuthProvider({ children }) {
  return (
    <AuthContext.Provider value={{
      user: null,
      isAuthenticated: false,
      isLoadingAuth: false
    }}>
      {children}
    </AuthContext.Provider>
  );
}

function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#071326',
      color: 'white',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      Fake Auth Works
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <FakeAuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </HashRouter>
      </FakeAuthProvider>
    </QueryClientProvider>
  );
}
