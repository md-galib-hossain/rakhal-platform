"use client"; // composes client-only providers (theme, query cache, toaster)

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <QueryProvider>
          {children}
          <Toaster richColors closeButton />
        </QueryProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
