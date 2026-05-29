import React from 'react';
import { HashRouter as Router } from 'react-router-dom';

export default function App() {
  return (
    <Router>
      <div style={{
        minHeight: '100vh',
        background: '#071326',
        color: 'white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        Router Test
      </div>
    </Router>
  );
}
