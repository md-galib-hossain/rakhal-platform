"use client"; // wires a retry click handler

import { AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Standard failed-fetch state for tables/lists/widgets, each wrapped in its own ErrorBoundary. */
export function ErrorState({ title = "Something went wrong", description, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive-tint">
        <AlertTriangle className="size-6 text-destructive" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
