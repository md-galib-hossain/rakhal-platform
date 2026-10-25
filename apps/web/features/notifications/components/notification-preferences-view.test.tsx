import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import en from "@/i18n/messages/en.json";
import { NotificationPreferencesView } from "./notification-preferences-view";

vi.mock("@/lib/auth/permissions", () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../hooks/use-notifications", () => ({
  useNotificationPreferences: () => ({
    data: {
      quiet_hours: { start: "22:00", end: "06:00" },
      preferences: [
        {
          event_key: "cow_sick",
          label: "Cow Sick Alert",
          category: "health_safety",
          can_disable: false,
          enabled: true,
          channels: {
            in_app: true,
            push: false,
            sms: false,
            whatsapp: false,
            telegram: true,
            email: false,
          },
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useUpdateNotificationPreferences: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useTelegramStatus: () => ({
    data: {
      configured: true,
      linked: false,
      count: 0,
    },
    isLoading: false,
    isError: false,
  }),
  useUnlinkTelegram: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useTelegramConnectSession: () => ({
    data: {
      configured: true,
      botUsername: "rakhal_farm_bot",
      code: "582914",
      expiresIn: 900,
      deepLink: "https://t.me/rakhal_farm_bot?start=582914",
      qrPayload: "https://t.me/rakhal_farm_bot?start=582914",
    },
    isLoading: false,
    isError: false,
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider messages={en} locale="en">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("NotificationPreferencesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders preferences view and opens TelegramConnectDialog when Connect Telegram is clicked", async () => {
    renderWithProviders(<NotificationPreferencesView />);

    expect(screen.getByText("Telegram Bot Alerts")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();

    const connectBtn = screen.getByRole("button", { name: /connect telegram/i });
    expect(connectBtn).toBeInTheDocument();

    // Click to open the connect dialog
    fireEvent.click(connectBtn);

    // Expect dialog content to appear
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Scan with phone camera to open in Telegram")).toBeInTheDocument();
    expect(screen.getByText("582914".slice(0, 1))).toBeInTheDocument();
  });
});
