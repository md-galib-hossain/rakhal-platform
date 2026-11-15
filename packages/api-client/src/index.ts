export * from "./envelope.ts";
export type { paths, components, operations } from "./generated/customer-api.d.ts";
import type { components } from "./generated/customer-api.d.ts";

/** Shorthand for a named schema: `Schema<"SaveMilkLogDto">`. */
export type Schema<K extends keyof components["schemas"]> = components["schemas"][K];
