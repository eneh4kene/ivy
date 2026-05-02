import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Ivy — AI-Powered Accountability",
  description: "Build unshakeable habits with AI-powered voice calls. Every workout completed donates to your chosen charity.",
  keywords: ["accountability", "habits", "wellness", "AI", "coaching", "charity"],
  openGraph: {
    title: "Ivy — AI-Powered Accountability",
    description: "Transform your habits while making an impact.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  )
}
