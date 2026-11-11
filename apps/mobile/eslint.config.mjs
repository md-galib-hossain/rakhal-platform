import { boundaryRules, typescriptBase } from "@rakhal/config/eslint";

export default [
  { ignores: ["node_modules", ".expo", "dist", "vendor", "expo-env.d.ts"] },
  ...typescriptBase,
  ...boundaryRules,
  {
    // Token files, scripts, tests and the vendored snapshot legitimately hold colour literals (spec 4.4).
    files: ["src/theme/**", "scripts/**", "test/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // WP1 tokens.ts uses a deliberately unused `_tint` parameter in a type-level helper; underscore-prefixed args are intentional.
    files: ["src/theme/**"],
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
];
