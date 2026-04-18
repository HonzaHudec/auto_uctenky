import type { Metadata } from "next"
import { HomePageContent } from "@/components/home-page-content"

export const metadata: Metadata = {
  title: "AutoÚčtenky — Sledování výdajů na auto",
  description:
    "Jednoduchá aplikace pro sdílené sledování výdajů na vozidlo. Tankování, servis, mytí — vše na jednom místě.",
}

export default function HomePage() {
  return <HomePageContent />
}
