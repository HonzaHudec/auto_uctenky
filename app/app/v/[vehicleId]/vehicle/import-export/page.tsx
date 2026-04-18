"use client"

import { use } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { ImportExportContent } from "@/components/import-export-content"

export default function ImportExportPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>
}) {
  const { vehicleId } = use(params)

  return (
    <AppShell vehicleId={vehicleId as Id<"vehicles">}>
      <ImportExportContent vehicleId={vehicleId as Id<"vehicles">} />
    </AppShell>
  )
}
