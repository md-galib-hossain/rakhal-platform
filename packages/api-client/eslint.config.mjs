import { boundaryRules, typescriptBase } from "@rakhal/config/eslint";

export default [
  { ignores: ["node_modules", "src/generated"] },
  ...typescriptBase,
  ...boundaryRules,
  {
    // Contract package stays framework-free: no React / React Native / Expo / UI imports.
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*", "react-native", "react-native/*", "react-dom", "expo", "expo-*", "@rakhal/ui", "@rakhal/ui/*"],
              message: "@rakhal/api-client must stay framework-free.",
            },
          ],
        },
      ],
    },
  },
];
