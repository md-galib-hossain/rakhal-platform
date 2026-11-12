"use client";

import { useEffect, useRef } from "react";

/**
 * Remembers the last value seen while `trusted` (loaded, not errored). While untrusted it returns that last
 * known value (or `undefined` if there never was one) so counts never flash fake zeros during a refetch,
 * a filter change or an error. `value` need not be referentially stable.
 *
 * The memory is a ref written in an effect (after commit) and only read while untrusted:
 * it never needs to trigger a render itself (the untrusted->trusted flip already does), so there is no
 * setState-in-render / setState-in-effect.
 */
export function useLastTrusted<T>(value: T, trusted: boolean): T | undefined {
  const lastRef = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (trusted) lastRef.current = value;
  }, [trusted, value]);
  // eslint-disable-next-line react-hooks/refs -- intentional: read only while untrusted, written after commit; never drives a render itself
  return trusted ? value : lastRef.current;
}
