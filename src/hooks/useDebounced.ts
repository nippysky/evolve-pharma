'use client';

import { useEffect, useState } from 'react';

/**
 * Trails a fast-changing value, so a burst of keystrokes produces one request
 * instead of one per character.
 *
 * The timer is cleared on every change, so only a pause longer than `delay`
 * lets the value through — and the cleanup means an unmount mid-type can't
 * fire a state update on a component that's gone.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
