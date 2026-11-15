// Compile-time contract checks: `pnpm typecheck` fails if the generated types lose these shapes.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Schema, paths } from "../src/index.ts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ok<_T extends true>(): void {}

type Save = Schema<"SaveMilkLogDto">;
ok<Equal<Save["session"], "MORNING" | "NOON" | "EVENING" | "NIGHT">>();
ok<Equal<Save["date"], string>>();
ok<Equal<Schema<"RegisterDeviceDto">["platform"], "android" | "ios" | "web">>();

type MilkLogPost = paths["/api/v1/milk/log"]["post"];
ok<Equal<MilkLogPost extends { requestBody: unknown } ? true : false, true>>();

test("generated schema types compile", () => {
  assert.ok(true);
});
