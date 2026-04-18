"use client"

import { use } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { ExpenseDetailContent } from "@/components/expense-detail-content"

export default function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string; expenseId: string }>
}) {
  const { vehicleId, expenseId } = use(params)

  return (
    <AppShell vehicleId={vehicleId as Id<"vehicles">}>
      <ExpenseDetailContent
        vehicleId={vehicleId as Id<"vehicles">}
        expenseId={expenseId as Id<"expenses">}
      />
    </AppShell>
  )
}
