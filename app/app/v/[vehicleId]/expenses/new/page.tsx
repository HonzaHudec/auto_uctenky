"use client"

import { use } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { NewExpenseContent } from "@/components/new-expense-content"

export default function NewExpensePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>
}) {
  const { vehicleId } = use(params)

  return (
    <AppShell vehicleId={vehicleId as Id<"vehicles">}>
      <NewExpenseContent vehicleId={vehicleId as Id<"vehicles">} />
    </AppShell>
  )
}
