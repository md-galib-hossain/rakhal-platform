import { boundaryRules, typescriptBase } from "@rakhal/config/eslint";

export default [{ ignores: ["node_modules"] }, ...typescriptBase, ...boundaryRules];
