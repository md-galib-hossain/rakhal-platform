import { boundaryRules, typescriptBase } from "@rakhal/config/eslint";

export default [
  { ignores: ["node_modules"] },
  ...typescriptBase,
  ...boundaryRules,
  {
    // Domain stays framework-free (spec 2.3): no React / React Native / Expo / UI package imports.
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*", "react-native", "react-native/*", "react-dom", "expo", "expo-*", "@rakhal/ui", "@rakhal/ui/*"],
              message: "@rakhal/domain must stay pure TypeScript.",
            },
          ],
        },
      ],
    },
  },
];
