/**
 * DiagOverlay — persistent native-only diagnostic overlay.
 *
 * Renders independently of app auth state. Uses its own polling loop
 * so it CANNOT cause remounts in the main app tree.
 * Never unmounts on native (no timeout).
 */
import { useState, useEffect, useRef } from 'react';
import { diagSubscribe, getDiagState } from '@/lib/diagLog';

// Same detection as AuthContext — module-level, evaluated once
const IS_NATIVE =
  typeof window !== 'undefined' &&
  (
    typeof window.Capacitor !== 'undefined' ||
    window.Capacitor?.isNativePlatform?.() ||
    window.location?.protocol === 'capacitor:' ||
    window.location?.protocol === 'ionic:'
  );

// v2 — force sync
export default function DiagOverlay() {
  const [data, setData] = useState(getDiagState);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    // Subscribe to diagLog updates
    const unsub = diagSubscribe(() => {
      setData(getDiagState());
    });
    return unsub;
  }, []);

  if (!IS_NATIVE) return null;

  const { events, counters } = data;

  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', top: 8, right: 8, zIndex: 99999,
          background: 'rgba(0,0,0,0.85)', borderRadius: 20,
          padding: '6px 14px', color: '#4ade80',
          fontFamily: 'monospace', fontSize: 12,
          pointerEvents: 'auto', cursor: 'pointer',
          border: '1px solid rgba(74,222,128,0.3)',
        }}
      >
        📊 DIAG [{events.length}]
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 99999,
      background: 'rgba(0,0,0,0.92)',
      fontFamily: 'monospace', fontSize: 10,
      color: '#e2e8f0',
      pointerEvents: 'auto',
      maxHeight: '55vh',
      overflowY: 'auto',
      borderBottom: '1px solid rgba(74,222,128,0.3)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 10px', background: 'rgba(0,0,0,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        position: 'sticky', top: 0,
      }}>
        <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 11 }}>
          ⚡ PP DIAGNOSTICS
        </span>
        <button
          onClick={() => setMinimized(true)}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.2)',
            color: '#94a3b8', borderRadius: 4, padding: '2px 8px',
            fontSize: 10, cursor: 'pointer',
          }}
        >
          minimize
        </button>
      </div>

      {/* Counters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4,
        padding: '6px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {Object.entries(counters).map(([k, v]) => (
          <span key={k} style={{
            background: v > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${v > 1 && k.includes('mount') ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 3, padding: '1px 5px', fontSize: 9,
            color: v > 1 && (k.includes('Unmount') || k.includes('Remount')) ? '#f87171' : '#94a3b8',
          }}>
            {k.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}: <strong style={{ color: '#fff' }}>{v}</strong>
          </span>
        ))}
      </div>

      {/* Event log */}
      <div style={{ padding: '4px 10px 10px' }}>
        {events.length === 0 && (
          <div style={{ color: '#475569', padding: '4px 0' }}>No events yet...</div>
        )}
        {events.map((e, i) => (
          <div key={i} style={{
            padding: '2px 0',
            color: e.label.includes('UNMOUNT') || e.label.includes('ERROR') ? '#f87171'
                 : e.label.includes('MOUNT') || e.label.includes('STARTED') ? '#4ade80'
                 : e.label.includes('REDIRECT') || e.label.includes('AUTH STATE') ? '#fbbf24'
                 : '#cbd5e1',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ color: '#475569', marginRight: 6 }}>+{e.ms}ms</span>
            {e.label}
            {e.detail && (
              <span style={{ color: '#64748b', marginLeft: 6 }}>
                {typeof e.detail === 'object' ? JSON.stringify(e.detail) : e.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
