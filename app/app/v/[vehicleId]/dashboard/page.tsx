"use client"

import { use } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { DashboardContent } from "@/components/dashboard-content"

export default function DashboardPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>
}) {
  const { vehicleId } = use(params)

  return (
    <AppShell vehicleId={vehicleId as Id<"vehicles">}>
      <DashboardContent vehicleId={vehicleId as Id<"vehicles">} />
    </AppShell>
  )
}
