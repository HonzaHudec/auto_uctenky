import "./globals.css"

import type { Metadata } from "next"
import { Exo_2, IBM_Plex_Sans } from "next/font/google"
import { ConvexClientProvider } from "@/components/convex-client-provider"
import { Toaster } from "@/components/ui/sonner"

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
})

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "AutoÚčtenky — Sledování výdajů na auto",
  description:
    "Aplikace pro sdílené sledování výdajů na vozidlo. Tankování, servis, mytí — vše na jednom místě.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="cs" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#080f1f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${exo2.variable} ${ibmPlexSans.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "var(--font-ibm-plex), system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        <ConvexClientProvider>
          {children}
          <Toaster richColors theme="dark" position="top-center" />
        </ConvexClientProvider>
      </body>
    </html>
  )
}
