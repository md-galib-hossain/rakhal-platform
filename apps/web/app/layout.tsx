import type { Metadata } from "next";
import { Noto_Sans_Bengali, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppProviders } from "@/providers/app-providers";
import { env } from "@/lib/env";
import "./globals.css";

const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  display: "swap",
});

const latin = Plus_Jakarta_Sans({
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
      className={`${bengali.variable} ${latin.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
