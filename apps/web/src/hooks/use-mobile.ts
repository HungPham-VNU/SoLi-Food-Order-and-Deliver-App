import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
  const getSnapshot = () =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false;
  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === 'undefined') return () => {};
    const mql = window.matchMedia(query);
    const onChange = () => onStoreChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
  const isMobile = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false,
  );

  return isMobile;
}
