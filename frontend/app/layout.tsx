import type { Metadata, Viewport } from "next"
import { Newsreader, Instrument_Sans, DM_Mono } from "next/font/google"
import "./globals.css"
import { PostHogProvider } from "@/lib/analytics/posthog"
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister"

/* ── Fonts ──────────────────────────────────────────────────────────────── */
// Display voice of the Living Vine language — an italic-forward serif.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  weight: ["300", "400", "500"],
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
/*
 * These are the site-wide defaults, and nothing overrode them — so every URL
 * on the domain unfurled as the consumer staking pitch, including the coach
 * signup link. Two things were wrong with the old copy beyond the audience:
 * money is now OPTIONAL (the teeth ladder — a member can run the whole loop
 * stake-less), and "somewhere you hate" only describes SAVAGE forfeit mode.
 * The default is MIDDLE: a house charity they did not choose. Route segments
 * that speak to someone specific override these below.
 */
export const metadata: Metadata = {
  title: "Ivy — Say it out loud. Then actually do it.",
  description: "An accountability coach who calls you every evening. Say what you'll do tomorrow, then account for whether you did it. Put money on it when you want it to bite.",
  keywords: ["accountability", "commitment", "voice note", "coaching", "habit", "stake"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ivy",
    startupImage: "/icons/icon-512x512.png",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Ivy — Say it out loud. Then actually do it.",
    description: "An accountability coach who calls you every evening. Say what you'll do tomorrow, then account for whether you did it.",
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
      className={`dark ${newsreader.variable} ${instrumentSans.variable} ${dmMono.variable}`}
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
        <ServiceWorkerRegister />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}
