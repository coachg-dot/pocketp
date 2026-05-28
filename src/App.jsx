import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from './lib/query-client';
import { HashRouter, Routes, Route } from 'react-router-dom';

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
      QueryClient Works
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
