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
      Router Works
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </HashRouter>
  );
}
