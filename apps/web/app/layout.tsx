import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { LocaleProvider } from "@rakhal/ui/lib/locale";
import { LabelsProvider } from "@rakhal/ui/lib/labels";
import { AppProviders } from "@/providers/app-providers";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/constants/i18n";
import "./globals.css";

const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  display: "swap",
});

const latin = Inter({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: { default: "Rakhal", template: "%s · Rakhal" },
  description: "Dairy-farm operations platform for Bangladesh.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("common");
  const labels = {
    datePicker: { today: t("today"), clear: t("clear") },
    dateTimePicker: {
      time: t("time"),
      hour: t("hour"),
      minute: t("minute"),
      now: t("now"),
      clear: t("clear"),
      done: t("done"),
    },
  };

  return (
    <html
      lang={locale}
      className={`${bengali.variable} ${latin.variable} h-full antialiased font-sans`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LocaleProvider locale={locale as Locale}>
            <LabelsProvider labels={labels}>
              <AppProviders>{children}</AppProviders>
            </LabelsProvider>
          </LocaleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
