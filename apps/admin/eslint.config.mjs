import nextVitals from "eslint-config-next/core-web-vitals";
import { boundaryRules } from "@rakhal/config/eslint";

const config = [
  { ignores: [".next", "node_modules", "next-env.d.ts"] },
  ...nextVitals,
  ...boundaryRules,
];

export default config;
