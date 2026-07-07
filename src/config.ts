import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import SentryClientInit from "@/components/observability/SentryClientInit";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription =
  "Relic Ring Protocol — low-latency routing simulation across the Zeta-26 star system. Stack Kings, LAUNCH 26.";

export const metadata: Metadata = {
  title: {
    default: "Relic Ring Protocol — Stack Kings",
    template: "%s | Relic Ring Protocol",
  },
  description: siteDescription,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://relic.inusha.me"),
  openGraph: {
    title: "Relic Ring Protocol — Stack Kings",
    description: siteDescription,
    type: "website",
    siteName: "Relic Ring Protocol",
  },
  twitter: {
    card: "summary_large_image",
    title: "Relic Ring Protocol — Stack Kings",
    description: siteDescription,
  },
  icons: {
    icon: "/icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SentryClientInit />
        {children}
      </body>
    </html>
  );
}
