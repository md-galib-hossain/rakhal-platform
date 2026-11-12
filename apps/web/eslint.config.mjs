import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next already registers the "jsx-a11y" plugin (6 rules); merge in the
  // full recommended rule set without re-registering the plugin (redefining it errors).
  { rules: jsxA11y.flatConfigs.recommended.rules },
  // Same story for "import" — eslint-config-next already registers it; only take the rules we need.
  {
    rules: {
      ...importPlugin.flatConfigs.typescript.rules,
      "import/no-cycle": ["error", { maxDepth: Infinity }],
      "import/no-self-import": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
