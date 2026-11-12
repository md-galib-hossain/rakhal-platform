"use client"; // composes client-only providers (theme, query cache, toaster)

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CattleDetailModalProvider } from "@/features/cattle/context/cattle-detail-modal-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <QueryProvider>
          <TooltipProvider delayDuration={200}>
            <CattleDetailModalProvider>
              {children}
              <Toaster richColors closeButton />
            </CattleDetailModalProvider>
          </TooltipProvider>
        </QueryProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
