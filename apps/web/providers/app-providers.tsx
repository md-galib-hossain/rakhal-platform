"use client"; // composes client-only providers (theme, query cache, toaster)

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useQueryState as useNuqsQueryState, parseAsString } from "nuqs";
import { QueryStateProvider, type QueryStateApi } from "@rakhal/ui/lib/query-state";
import { Toaster } from "@rakhal/ui/ui/sonner";
import { TooltipProvider } from "@rakhal/ui/ui/tooltip";
import { CattleDetailModalProvider } from "@/features/cattle/context/cattle-detail-modal-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

/** Adapts nuqs's own `useQueryState` to the narrower, nuqs-independent shape
 * `@rakhal/ui`'s `QueryStateProvider` expects (string params only). */
const useQueryStateHook: QueryStateApi["useQueryState"] = (key, defaultValue) =>
  useNuqsQueryState(key, defaultValue !== undefined ? parseAsString.withDefault(defaultValue) : parseAsString);

/** Adapts `next/navigation`'s `useSearchParams` (a `ReadonlyURLSearchParams`, API-compatible with
 * `URLSearchParams`'s `.get`/`.has`) to `@rakhal/ui`'s router-independent snapshot shape. */
function useSearchParamsSnapshotHook(): URLSearchParams {
  return useSearchParams() as unknown as URLSearchParams;
}

/** Adapts Next's router (`replace` + the current pathname) to a plain "remove these query keys"
 * action, so `@rakhal/ui`'s `FilterBar` never imports `next/navigation` itself. */
function useClearQueryParamsHook(): (keys: string[]) => void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  return useCallback(
    (keys: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      keys.forEach((k) => params.delete(k));
      router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
    },
    [router, searchParams, pathname],
  );
}

function useSharedQueryStateApi(): QueryStateApi {
  return {
    useQueryState: useQueryStateHook,
    useSearchParamsSnapshot: useSearchParamsSnapshotHook,
    useClearQueryParams: useClearQueryParamsHook,
  };
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <QueryStateProviderBridge>
          <QueryProvider>
            <TooltipProvider delayDuration={200}>
              <CattleDetailModalProvider>
                {children}
                <Toaster richColors closeButton />
              </CattleDetailModalProvider>
            </TooltipProvider>
          </QueryProvider>
        </QueryStateProviderBridge>
      </NuqsAdapter>
    </ThemeProvider>
  );
}

/** Calling the adapter hooks (which themselves call Next's router hooks) must happen inside
 * `NuqsAdapter`/the router tree, so this is a separate component rather than inlined above. */
function QueryStateProviderBridge({ children }: { children: React.ReactNode }) {
  return <QueryStateProvider api={useSharedQueryStateApi()}>{children}</QueryStateProvider>;
}
