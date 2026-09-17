'use client';

import { useSyncExternalStore } from 'react';

function subscribe(query: string) {
  return (cb: () => void) => {
    const mql = window.matchMedia(query);
    // Handle Safari fallback
    if ('addEventListener' in mql) mql.addEventListener('change', cb);
    else (mql as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(cb);
    return () => {
      if ('removeEventListener' in mql) mql.removeEventListener('change', cb);
      else (mql as MediaQueryList & { removeListener: (cb: () => void) => void }).removeListener(cb);
    };
  };
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => false, // SSR: default to desktop
  );
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
