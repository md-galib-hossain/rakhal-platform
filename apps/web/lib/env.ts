import { z } from "zod";

/**
 * Server-only env. `API_BASE_URL` is the rakhal-backend origin — it is never
 * exposed to the browser (no NEXT_PUBLIC_ prefix): all client fetches go
 * through our own `app/api/*` BFF bridge (ARCHITECTURE.md §5), which is the
 * only place this value is read.
 */
const serverSchema = z.object({
  API_BASE_URL: z.url().default("http://localhost:3005/api/v1"),
});

/** Public env — safe to ship to the browser. */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3005"),
  /**
   * Origin of the `farm.rakhal.app` app shell (auth/onboarding/dashboard). The
   * marketing landing page (this app's `/`) links out to it directly instead of
   * routing those pages through its own origin — see RFE-100 domain split,
   * `proxy.ts`'s `FARM_HOSTS`/`toFarmUrl`.
   */
  NEXT_PUBLIC_FARM_URL: z.url().default("https://farm.rakhal.app"),
});

function parse<T extends z.ZodTypeAny>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    console.error("Invalid environment variables:", z.treeifyError(result.error));
    throw new Error("Invalid environment variables — see log above.");
  }
  return result.data;
}

const isServer = typeof window === "undefined";

export const serverEnv = isServer
  ? parse(serverSchema, { API_BASE_URL: process.env.API_BASE_URL })
  : (undefined as never); // never read on the client

export const env = parse(clientSchema, {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_FARM_URL: process.env.NEXT_PUBLIC_FARM_URL,
});
