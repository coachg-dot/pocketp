import React from 'react';
import { HashRouter as Router } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <div style={{
          minHeight: '100vh',
          background: '#071326',
          color: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          Toaster Test
        </div>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
