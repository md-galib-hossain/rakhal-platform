"use client"; // composes client-only providers (theme, toaster; query client joins in RFE-003)

import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { ThemeProvider } from "./theme-provider";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} richColors closeButton />;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <ThemedToaster />
    </ThemeProvider>
  );
}
