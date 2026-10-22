// Shared flat ESLint rules for Rakhal platform apps. Layer boundaries adapted from BusinessOS.
export const boundaryRules = [
  {
    // Primitives must stay presentational: no imports from shared/feature/app code.
    files: ["**/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/shared/*", "**/features/*", "next-intl", "@/features/*"], message: "ui primitives must not import shared, feature or i18n code." },
          ],
        },
      ],
    },
  },
  {
    // Raw fetch only inside lib/api and feature api.ts files.
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/lib/api/**", "**/features/*/api.ts", "**/*.test.{ts,tsx}", "**/app/api/**"],
    rules: {
      "no-restricted-globals": ["error", { name: "fetch", message: "Use the typed API client (lib/api or features/*/api.ts)." }],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-alert": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]", message: "Use semantic design tokens, not raw hex colours." },
      ],
    },
  },
];

import tseslint from "typescript-eslint";

/** Parser + recommended TS rules for packages that do not use eslint-config-next. */
export const typescriptBase = tseslint.configs.recommended;
