import type { Metadata, Viewport } from "next"
import { Lora, Instrument_Sans, DM_Mono } from "next/font/google"
import "./globals.css"
import { PostHogProvider } from "@/lib/analytics/posthog"

/* ── Fonts ──────────────────────────────────────────────────────────────── */
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
})

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
  weight: ["400", "500"],
})

/* ── Metadata ────────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: "Ivy — The accountability that has teeth",
  description: "Your money. Your commitment. Your chosen charity gets it when you follow through — or somewhere you hate when you don't.",
  keywords: ["accountability", "commitment", "voice note", "charity", "habit", "stake"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ivy",
    startupImage: "/icons/icon-512x512.png",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Ivy — The accountability that has teeth",
    description: "Put your money where your commitment is. Follow through — or it goes somewhere you'd hate.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/icons/icon-16x16.png",  sizes: "16x16",  type: "image/png" },
      { url: "/icons/icon-32x32.png",  sizes: "32x32",  type: "image/png" },
      { url: "/icons/icon-96x96.png",  sizes: "96x96",  type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: "#0b0d0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Prevents browser chrome from overlapping content
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${lora.variable} ${instrumentSans.variable} ${dmMono.variable}`}
    >
      <head>
        <meta name="mobile-web-app-capable"           content="yes" />
        <meta name="apple-mobile-web-app-capable"     content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title"       content="Ivy" />
        <meta name="msapplication-TileColor"          content="#0b0d0a" />
        <meta name="msapplication-tap-highlight"      content="no" />
      </head>
      <body className="font-sans bg-background text-foreground">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}
