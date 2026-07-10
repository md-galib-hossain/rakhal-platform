"use client"; // composes client-only providers (theme, query cache, toaster)

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <QueryProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster richColors closeButton />
          </TooltipProvider>
        </QueryProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
