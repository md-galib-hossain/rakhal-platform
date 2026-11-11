// Component tests only (src/**/*.test.tsx). Pure TS tests stay on `node --test` (test/*.test.ts).
// jest-expo's default transformIgnorePatterns already allow the pnpm `.pnpm` segment.
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.tsx"],
};
