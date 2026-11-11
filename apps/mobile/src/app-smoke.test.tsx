import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Index from "../app/index.tsx";
import { AppProviders } from "./providers/AppProviders.tsx";
import { memoryPrefs, PREF_KEYS } from "./storage/prefs.ts";
import { colorsDark, colorsLight } from "./theme/tokens.ts";

jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: () => Promise.resolve(true),
  hideAsync: () => Promise.resolve(true),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

async function mountIndex(prefs: Record<string, string>) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppProviders storage={memoryPrefs(prefs)}>
        <Index />
      </AppProviders>
    </SafeAreaProvider>,
  );
}

describe("app/index placeholder", () => {
  it("renders the app name inside the real providers using a theme foreground colour (dark)", async () => {
    await mountIndex({ [PREF_KEYS.theme]: "dark", [PREF_KEYS.locale]: "en" });
    const title = await waitFor(() => screen.getByText("Rakhal"));
    expect(title).toHaveStyle({ color: colorsDark.foreground });
    expect(title).not.toHaveStyle({ color: colorsLight.foreground });
  });

  it("renders the Bangla app name by default", async () => {
    await mountIndex({ [PREF_KEYS.theme]: "dark" });
    expect(await waitFor(() => screen.getByText("রাখাল"))).toBeTruthy();
  });
});
