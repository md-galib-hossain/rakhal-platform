import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import en from "@/i18n/messages/en.json";
import { TelegramConnectDialog } from "./telegram-connect-dialog";
import type { TelegramConnectSessionResult, TelegramStatusResult } from "../types";

let mockSessionData: TelegramConnectSessionResult | undefined = {
  configured: true,
  botUsername: "rakhal_farm_bot",
  code: "582914",
  expiresIn: 900,
  deepLink: "https://t.me/rakhal_farm_bot?start=582914",
  qrPayload: "https://t.me/rakhal_farm_bot?start=582914",
};

let mockIsSessionLoading = false;
let mockIsSessionError = false;

let mockStatusData: TelegramStatusResult = {
  configured: true,
  linked: false,
  count: 0,
};

vi.mock("../hooks/use-notifications", () => ({
  useTelegramConnectSession: (enabled: boolean) => ({
    data: mockSessionData,
    isLoading: mockIsSessionLoading,
    isError: mockIsSessionError,
    refetch: vi.fn(),
  }),
  useTelegramStatus: (options?: { refetchInterval?: number | false }) => ({
    data: mockStatusData,
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

describe("TelegramConnectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = {
      configured: true,
      botUsername: "rakhal_farm_bot",
      code: "582914",
      expiresIn: 900,
      deepLink: "https://t.me/rakhal_farm_bot?start=582914",
      qrPayload: "https://t.me/rakhal_farm_bot?start=582914",
    };
    mockIsSessionLoading = false;
    mockIsSessionError = false;
    mockStatusData = {
      configured: true,
      linked: false,
      count: 0,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders QR code, 6-digit monospace code, instructions, and open app button", () => {
    renderWithProviders(
      <TelegramConnectDialog open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByText("Connect Telegram")).toBeInTheDocument();
    expect(screen.getByText("Scan with phone camera to open in Telegram")).toBeInTheDocument();

    // Check each digit of 582914
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    expect(
      screen.getByText("Send this code to @rakhal_farm_bot in Telegram"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open telegram app/i })).toBeInTheDocument();
  });

  it("copies code to clipboard and updates button state", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    renderWithProviders(
      <TelegramConnectDialog open={true} onOpenChange={vi.fn()} />,
    );

    const copyBtn = screen.getByRole("button", { name: /copy code/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("582914");
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("opens deep link in a new window when Open Telegram App is clicked", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderWithProviders(
      <TelegramConnectDialog open={true} onOpenChange={vi.fn()} />,
    );

    const openBtn = screen.getByRole("button", { name: /open telegram app/i });
    fireEvent.click(openBtn);

    expect(openSpy).toHaveBeenCalledWith(
      "https://t.me/rakhal_farm_bot?start=582914",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("shows celebration and auto-closes after 1.5s when telegram status is linked", async () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();

    mockStatusData = {
      configured: true,
      linked: true,
      count: 1,
    };

    renderWithProviders(
      <TelegramConnectDialog open={true} onOpenChange={onOpenChange} />,
    );

    expect(screen.getByText("Successfully connected!")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders loading state when session is being fetched", () => {
    mockIsSessionLoading = true;
    mockSessionData = undefined;

    renderWithProviders(
      <TelegramConnectDialog open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByText("Loading connection details…")).toBeInTheDocument();
  });

  it("renders unconfigured notice if bot is not configured", () => {
    mockSessionData = {
      configured: false,
      botUsername: null,
      code: null,
      expiresIn: 0,
      deepLink: null,
      qrPayload: null,
    };

    renderWithProviders(
      <TelegramConnectDialog open={true} onOpenChange={vi.fn()} />,
    );

    expect(
      screen.getByText("Telegram bot integration is not configured on this server."),
    ).toBeInTheDocument();
  });
});
