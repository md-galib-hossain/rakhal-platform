"use client"; // TanStack Query's client-side cache/provider

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { makeQueryClient } from "@/lib/query/client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One QueryClient per component instance (not module-level) — sharing one across requests on
  // the server would leak data between users; useState guarantees it survives client re-renders.
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
