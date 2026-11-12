"use client"; // window.matchMedia

import { useEffect, useState } from "react";

/** SSR-safe viewport match. Starts `false` (matches the server's markup — no `window` at render
 * time) and syncs to the real value right after mount, then on every subsequent change. Used to
 * seed a view-mode default (e.g. cards on mobile) rather than to conditionally render markup,
 * since the latter would fight hydration. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    // Syncing from an external browser API (matchMedia) right after mount is the documented use
    // case for this pattern, not a cascading derived-state update; same precedent as this
    // codebase's other window/DOM-sync effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
