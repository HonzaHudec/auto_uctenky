"use client"

import { use } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { ExpensesListContent } from "@/components/expenses-list-content"

export default function ExpensesPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>
}) {
  const { vehicleId } = use(params)

  return (
    <AppShell vehicleId={vehicleId as Id<"vehicles">}>
      <ExpensesListContent vehicleId={vehicleId as Id<"vehicles">} />
    </AppShell>
  )
}
