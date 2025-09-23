import type {Metadata, Viewport} from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookiesBanner from "@/components/misc/CookiesBanner"
import AnalyticsGate from "@/components/misc/AnalyticsGate"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "MonkeysMail — Email delivery, tracking & automation",
    description:
        "MonkeysMail is a fast, developer-friendly email platform for sending, tracking, and automating campaigns with powerful APIs, webhooks, segmentation, and analytics.",
    keywords: [
        "email",
        "transactional email",
        "email API",
        "SMTP",
        "webhooks",
        "campaigns",
        "deliverability",
        "analytics",
        "segmentation",
        "GDPR",
    ],
    applicationName: "MonkeysMail",
    authors: [{ name: "MonkeysCloud" }],
    metadataBase: new URL("https://smtp.monkeysmail.com"),

    openGraph: {
        title: "MonkeysMail — Email delivery, tracking & automation",
        description:
            "Send reliably. Track precisely. Automate at scale. MonkeysMail gives teams the tools to build, ship, and measure email with confidence.",
        url: "https://smtp.monkeysmail.com",
        siteName: "MonkeysMail",
        images: [
            {
                url: "/og/monkeysmail-og.png",
                width: 1200,
                height: 630,
                alt: "MonkeysMail dashboard preview",
            },
        ],
        type: "website",
        locale: "en_US",
    },

    twitter: {
        card: "summary_large_image",
        title: "MonkeysMail — Email delivery, tracking & automation",
        description:
            "Developer-friendly email platform: SMTP & REST API, events, segments, and real-time analytics.",
        images: ["/og/monkeysmail-og.png"],
    },

    icons: {
        icon: "/favicon.ico",
        apple: "/apple-touch-icon.png",
    },
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#111827" },
    ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <CookiesBanner />
        <AnalyticsGate gaMeasurementId={process.env.NEXT_PUBLIC_GA_ID} />
      </body>
    </html>
  );
}
