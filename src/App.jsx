import React from 'react';
import { HashRouter as Router } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/AuthContext';

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AuthProvider>
          <div style={{
            minHeight: '100vh',
            background: '#071326',
            color: 'white',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            AuthProvider Test
          </div>
        </AuthProvider>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
