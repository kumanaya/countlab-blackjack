'use client';
import { useEffect } from 'react';

/** Registers the offline service worker in production builds only
 * (in dev it would cache stale Turbopack chunks). */
export function usePwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is optional */
    });
  }, []);
}
