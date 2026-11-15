import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { LocaleProvider } from "@rakhal/ui/lib/locale";
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

  return (
    <html
      lang={locale}
      className={`${bengali.variable} ${latin.variable} h-full antialiased font-sans`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LocaleProvider locale={locale as Locale}>
            <AppProviders>{children}</AppProviders>
          </LocaleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
