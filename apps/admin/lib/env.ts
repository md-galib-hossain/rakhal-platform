import { z } from "zod";

const schema = z.object({
  ADMIN_API_BASE_URL: z.url().default("http://localhost:5005/api/v1"),
});

/** Server-only env; throws at boot on invalid configuration. */
export const env = schema.parse({ ADMIN_API_BASE_URL: process.env.ADMIN_API_BASE_URL });
