export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#071326',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
      padding: 24,
      textAlign: 'center'
    }}>
      <h1>Pocket Pitcher</h1>
      <p>Native iOS startup test successful</p>
      <button
        style={{
          marginTop: 24,
          padding: '14px 22px',
          borderRadius: 12,
          border: 'none',
          fontWeight: 700
        }}
        onClick={() => alert('Native shell is stable')}
      >
        Continue to App
      </button>
    </div>
  );
}
