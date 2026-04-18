"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import Link from "next/link"
import { format } from "date-fns"
import { cs } from "date-fns/locale"
import {
  Fuel,
  Receipt,
  Plus,
  AlertTriangle,
  Wrench,
  CreditCard,
} from "lucide-react"

interface Props {
  vehicleId: Id<"vehicles">
}

const typeLabel: Record<string, string> = {
  fuel: "Tankování",
  // Legacy types mapped to display labels
  car_wash: "Výdaje",
  tires: "Výdaje",
  insurance: "Výdaje",
  other: "Výdaje",
  // New types
  expense: "Výdaje",
  service: "Servis",
  installment: "Pořízení / splátka",
}

const typeIcon: Record<string, React.ElementType> = {
  fuel: Fuel,
  car_wash: Receipt,
  service: Wrench,
  tires: Receipt,
  insurance: Receipt,
  installment: CreditCard,
  other: Receipt,
  expense: Receipt,
}

const typeColor: Record<string, string> = {
  fuel:        "bg-fuel-muted text-fuel",
  service:     "bg-warning/10 text-warning",
  installment: "bg-orange-500/10 text-orange-400",
  car_wash:    "bg-sky-500/10 text-sky-400",
  tires:       "bg-sky-500/10 text-sky-400",
  insurance:   "bg-sky-500/10 text-sky-400",
  other:       "bg-sky-500/10 text-sky-400",
  expense:     "bg-sky-500/10 text-sky-400",
}

function fmt(n: number | null | undefined, dec = 1) {
  if (n == null) return null
  return n.toFixed(dec).replace(".", ",")
}

function fmtCzk(n: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n)
}

function groupByMonth(expenses: any[]) {
  const groups: Record<string, any[]> = {}
  for (const e of expenses) {
    const key = format(new Date(e.date), "LLLL yyyy", { locale: cs })
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return groups
}

export function ExpensesListContent({ vehicleId }: Props) {
  const expenses = useQuery(api.expenses.listExpenses, { vehicleId, limit: 200 })

  if (expenses === undefined) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-exo2)" }}>
          Záznamy
        </h1>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="p-4 lg:p-6">
        <h1
          className="text-2xl font-bold mb-6"
          style={{ fontFamily: "var(--font-exo2)" }}
        >
          Záznamy
        </h1>
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Fuel className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Zatím žádné záznamy</p>
          <Link
            href={`/app/v/${vehicleId}/expenses/new`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Přidat tankování
          </Link>
        </div>
      </div>
    )
  }

  const groups = groupByMonth(expenses)

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-exo2)" }}
        >
          Záznamy
        </h1>
        <Link
          href={`/app/v/${vehicleId}/expenses/new`}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Přidat
        </Link>
      </div>

      <div className="space-y-6">
        {Object.entries(groups).map(([month, items]) => {
          const monthTotal = items.reduce((sum, e) => sum + e.amountCzk, 0)
          return (
            <div key={month}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h2
                  className="text-sm font-semibold text-muted-foreground uppercase tracking-wider"
                  style={{ fontFamily: "var(--font-exo2)" }}
                >
                  {month}
                </h2>
                <span className="text-sm font-semibold">{fmtCzk(monthTotal)}</span>
              </div>

              <div className="space-y-2">
                {items.map((expense) => {
                  const Icon = typeIcon[expense.type] ?? Receipt
                  const colorClass = typeColor[expense.type] ?? typeColor.other

                  return (
                    <Link
                      key={expense._id}
                      href={`/app/v/${vehicleId}/expenses/${expense._id}`}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-border/80 hover:bg-secondary/40 transition-all"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">
                            {typeLabel[expense.type] ?? expense.type}
                          </span>
                          {expense.needsReview && (
                            <span
                              title="Neobvyklá spotřeba nebo vzdálenost — zkontrolujte data"
                              className="inline-flex items-center gap-0.5 text-yellow-500"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-[10px] font-medium leading-none">Zkontrolovat</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(expense.date), "d. M.", { locale: cs })}
                          {expense.type === "fuel" && expense.liters && (
                            <> · {fmt(expense.liters, 2)} l</>
                          )}
                          {expense.type === "fuel" && expense.odometerKmTotal && (
                            <> · {expense.odometerKmTotal.toLocaleString("cs-CZ")} km</>
                          )}
                          {expense.type === "fuel" && expense.consumptionLPer100 && (
                            <> · {fmt(expense.consumptionLPer100)} l/100</>
                          )}
                        </p>
                      </div>

                      <span className="text-sm font-semibold shrink-0">
                        {fmtCzk(expense.amountCzk)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
