import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // Auth/permission errors never resolve by retrying; validation errors are the caller's
          // fault. Everything else (network blips, 5xx) gets a couple of retries.
          if (error instanceof ApiError && (error.isAuthError || error.isForbidden || error.isValidation)) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });
}
