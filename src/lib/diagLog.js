/**
 * diagLog.js — Singleton diagnostic event logger.
 *
 * Pure JS, zero React state. Safe to call from any lifecycle hook,
 * render function, or module-level code without causing re-renders.
 *
 * Usage:
 *   import { diagLog } from '@/lib/diagLog';
 *   diagLog('AUTH PROVIDER MOUNTED');
 */

if (!window.__PP_DIAG__) {
  window.__PP_DIAG__ = {
    events: [],
    counters: {
      appRenders: 0,
      appMounts: 0,
      appUnmounts: 0,
      authProviderMounts: 0,
      authProviderUnmounts: 0,
      authStateChanges: 0,
      routerMounts: 0,
      loginScreenRenders: 0,
      mainScreenRenders: 0,
      redirectsTriggered: 0,
      routeChanges: 0,
    },
    listeners: [],
    notifyListeners() {
      this.listeners.forEach(fn => fn());
    },
  };
}

const _d = window.__PP_DIAG__;

export function diagLog(label, detail) {
  const ms = Date.now() - (window.__PP_START__ || Date.now());
  const entry = { ms, label, detail };
  _d.events.push(entry);
  if (_d.events.length > 60) _d.events.shift();
  // Also echo to console for Xcode / TestFlight logs
  console.log(`[PP-DIAG +${ms}ms] ${label}${detail ? ' | ' + JSON.stringify(detail) : ''}`);
  _d.notifyListeners();
}

export function diagCount(counter) {
  if (_d.counters[counter] !== undefined) {
    _d.counters[counter]++;
    _d.notifyListeners();
  }
}

export function diagSubscribe(fn) {
  _d.listeners.push(fn);
  return () => {
    _d.listeners = _d.listeners.filter(l => l !== fn);
  };
}

export function getDiagState() {
  return { events: [..._d.events], counters: { ..._d.counters } };
}

// Record app start time once at module load
if (!window.__PP_START__) {
  window.__PP_START__ = Date.now();
}
// v2 — force sync
