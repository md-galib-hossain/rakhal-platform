"use client"; // Next.js error.tsx boundaries must be Client Components

import { useEffect } from "react";
import { ErrorState } from "@rakhal/ui/shared/error-state";

/** Generic per-segment `error.tsx` body. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState onRetry={reset} className="mt-8" />;
}
