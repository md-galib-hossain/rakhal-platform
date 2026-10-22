"use client";

import { Button } from "@rakhal/ui/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The admin API did not answer as expected. Try again; if it keeps happening, check the backend logs.
      </p>
      {error.digest ? <code className="rounded bg-muted px-2 py-1 text-xs">ref {error.digest}</code> : null}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
