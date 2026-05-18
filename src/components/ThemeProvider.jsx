import { useEffect } from 'react';

/**
 * Syncs the `dark` class on <html> with the system's prefers-color-scheme.
 * No state / context needed — just a side-effect component placed once in Layout.
 */
export default function ThemeProvider() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (dark) => {
      document.documentElement.classList.toggle('dark', dark);
    };

    apply(mq.matches);

    const handler = (e) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return null;
}