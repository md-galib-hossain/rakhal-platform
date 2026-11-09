import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import bn from "@/i18n/messages/bn.json";
import en from "@/i18n/messages/en.json";
import { closeNotificationSheet, useNotificationSheetState } from "@/features/notifications/sheet-store";
import { NotificationSettingsLink } from "./notification-settings-link";

describe("NotificationSettingsLink", () => {
  afterEach(() => act(() => closeNotificationSheet()));

  it("opens the notification sheet on its settings view", () => {
    const state = renderHook(() => useNotificationSheetState());
    render(
      <NextIntlClientProvider messages={en} locale="en">
        <NotificationSettingsLink />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open notification settings" }));
    expect(state.result.current).toEqual({ open: true, view: "settings", compose: null });
  });

  it("renders in Bangla", () => {
    render(
      <NextIntlClientProvider messages={bn} locale="bn">
        <NotificationSettingsLink />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "বিজ্ঞপ্তির সেটিংস খুলুন" })).toBeInTheDocument();
  });
});
