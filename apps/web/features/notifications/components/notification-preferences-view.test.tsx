import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import en from "@/i18n/messages/en.json";
import { NotificationPreferencesView } from "./notification-preferences-view";

vi.mock("@/lib/auth/permissions", () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUnlink = vi.fn();
const mockUpdate = vi.fn();

let mockTelegramStatus = {
  configured: true,
  linked: false,
  count: 0,
};

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
            push: true,
            sms: false,
            whatsapp: false,
            telegram: true,
            email: false,
          },
        },
        {
          event_key: "milk_target_missed",
          label: "Milk Target Missed",
          category: "operational",
          can_disable: true,
          enabled: true,
          channels: {
            in_app: true,
            push: false,
            sms: true,
            whatsapp: false,
            telegram: false,
            email: false,
          },
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useUpdateNotificationPreferences: () => ({
    mutate: mockUpdate,
    isPending: false,
  }),
  useTelegramStatus: () => ({
    data: mockTelegramStatus,
    isLoading: false,
    isError: false,
  }),
  useUnlinkTelegram: () => ({
    mutate: mockUnlink,
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
    mockTelegramStatus = {
      configured: true,
      linked: false,
      count: 0,
    };
  });

  it("renders Delivery Channels Hub with Telegram, SMS, and Push cards", () => {
    renderWithProviders(<NotificationPreferencesView />);

    expect(screen.getByText("Notification Delivery Channels")).toBeInTheDocument();
    expect(screen.getByTestId("channel-card-telegram")).toBeInTheDocument();
    expect(screen.getByTestId("channel-card-sms")).toBeInTheDocument();
    expect(screen.getByTestId("channel-card-push")).toBeInTheDocument();

    expect(screen.getAllByText("Not connected").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /connect telegram/i })).toBeInTheDocument();
  });

  it("opens TelegramConnectDialog when Connect Telegram is clicked", async () => {
    renderWithProviders(<NotificationPreferencesView />);

    const connectBtn = screen.getByRole("button", { name: /connect telegram/i });
    fireEvent.click(connectBtn);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Scan with phone camera to open in Telegram")).toBeInTheDocument();
    expect(screen.getByText("582914".slice(0, 1))).toBeInTheDocument();
  });

  it("allows muting Telegram notifications without disconnecting", () => {
    mockTelegramStatus = {
      configured: true,
      linked: true,
      count: 1,
    };

    renderWithProviders(<NotificationPreferencesView />);

    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();

    // Find the toggle switch for Telegram
    const toggle = screen.getByRole("switch", { name: /toggle telegram notifications delivery/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");

    // Click to mute
    fireEvent.click(toggle);
    expect(screen.getAllByText("Muted").length).toBeGreaterThan(0);
  });

  it("renders per-event channel personalization with Telegram and SMS pills", () => {
    renderWithProviders(<NotificationPreferencesView />);

    expect(screen.getByText("Notification Routing & Personalization")).toBeInTheDocument();
    expect(screen.getByText("Cow Sick Alert")).toBeInTheDocument();
    expect(screen.getByText("Milk Target Missed")).toBeInTheDocument();

    // Filter by category
    const healthFilter = screen.getByRole("button", { name: /health & safety/i });
    fireEvent.click(healthFilter);

    expect(screen.getByText("Cow Sick Alert")).toBeInTheDocument();
    expect(screen.queryByText("Milk Target Missed")).not.toBeInTheDocument();
  });
});
