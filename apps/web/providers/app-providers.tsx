"use client"; // composes client-only providers (theme, query cache, toaster)

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useQueryState as useNuqsQueryState, parseAsString } from "nuqs";
import { QueryStateProvider, type QueryStateHook } from "@rakhal/ui/lib/query-state";
import { Toaster } from "@rakhal/ui/ui/sonner";
import { TooltipProvider } from "@rakhal/ui/ui/tooltip";
import { CattleDetailModalProvider } from "@/features/cattle/context/cattle-detail-modal-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

/** Adapts nuqs's own `useQueryState` to the narrower, nuqs-independent shape
 * `@rakhal/ui`'s `QueryStateProvider` expects (string params only). */
const useSharedQueryStateHook: QueryStateHook = (key, defaultValue) =>
  useNuqsQueryState(key, defaultValue !== undefined ? parseAsString.withDefault(defaultValue) : parseAsString);

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <QueryStateProvider useQueryState={useSharedQueryStateHook}>
          <QueryProvider>
            <TooltipProvider delayDuration={200}>
              <CattleDetailModalProvider>
                {children}
                <Toaster richColors closeButton />
              </CattleDetailModalProvider>
            </TooltipProvider>
          </QueryProvider>
        </QueryStateProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
