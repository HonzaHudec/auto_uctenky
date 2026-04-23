"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { format } from "date-fns"
import { cs } from "date-fns/locale"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import {
  ChevronLeft,
  ChevronRight,
  Fuel,
  Wrench,
  CreditCard,
  Receipt,
  TrendingDown,
  Route,
  Gauge,
  Coins,
  Zap,
} from "lucide-react"

interface Props {
  vehicleId: Id<"vehicles">
}

type Mode = "months" | "years" | "all"

const TYPE_LABELS: Record<string, string> = {
  fuel: "Tankování",
  // Legacy types
  car_wash: "Výdaje",
  tires: "Výdaje",
  insurance: "Výdaje",
  other: "Výdaje",
  // New types
  expense: "Výdaje",
  service: "Servis",
  installment: "Pořízení / splátka",
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  fuel:        Fuel,
  service:     Wrench,
  installment: CreditCard,
  car_wash:    Receipt,
  tires:       Receipt,
  insurance:   Receipt,
  other:       Receipt,
  expense:     Receipt,
}

const TYPE_COLORS: Record<string, { bg: string; icon: string }> = {
  fuel:        { bg: "bg-fuel-muted",      icon: "text-fuel" },
  service:     { bg: "bg-warning/10",      icon: "text-warning" },
  installment: { bg: "bg-orange-500/10",   icon: "text-orange-400" },
  car_wash:    { bg: "bg-sky-500/10",      icon: "text-sky-400" },
  tires:       { bg: "bg-sky-500/10",      icon: "text-sky-400" },
  insurance:   { bg: "bg-sky-500/10",      icon: "text-sky-400" },
  other:       { bg: "bg-sky-500/10",      icon: "text-sky-400" },
  expense:     { bg: "bg-sky-500/10",      icon: "text-sky-400" },
}

const VARIABLE_TYPES = ["fuel", "car_wash", "other", "expense", "tires"]

function fmt(n: number | null | undefined, dec = 1) {
  if (n == null) return "–"
  return n.toFixed(dec).replace(".", ",")
}

function fmtCzk(n: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n)
}

function bucketLabel(key: string, mode: Mode): string {
  if (mode === "months" || (mode === "all" && key.includes("-"))) {
    const [y, m] = key.split("-")
    const d = new Date(Number(y), Number(m) - 1, 1)
    return format(d, "LLL", { locale: cs })
  }
  return key
}

export function CostsContent({ vehicleId }: Props) {
  const now = new Date()
  const [mode, setMode] = useState<Mode>("months")
  const [year, setYear] = useState(now.getFullYear())
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

  const data = useQuery(api.expenses.getCostsByPeriod, { vehicleId, mode, year })

  const buckets = data?.buckets ?? []
  const allExpenses = data?.expenses ?? []

  // Year range for navigation in months mode
  const availableYears = useMemo(() => {
    if (!data?.expenses.length) return [now.getFullYear()]
    const years = Array.from(new Set(data.expenses.map((e) => new Date(e.date).getFullYear())))
    years.sort()
    return years
  }, [data])

  const minYear = availableYears[0] ?? now.getFullYear()
  const maxYear = availableYears[availableYears.length - 1] ?? now.getFullYear()

  // Summary for current view
  const totalAll = buckets.reduce((s, b) => s + b.total, 0)
  const totalFuel = buckets.reduce((s, b) => s + b.fuel, 0)
  const totalFixed = buckets.reduce((s, b) => s + b.fixed, 0)

  // Expenses filtered by selected bucket
  const visibleExpenses = useMemo(() => {
    if (!selectedBucket) return allExpenses
    return allExpenses.filter((e) => {
      const d = new Date(e.date)
      if (mode === "months") {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        return key === selectedBucket
      }
      return `${d.getFullYear()}` === selectedBucket
    })
  }, [allExpenses, selectedBucket, mode])

  // Group visible expenses by period label
  const grouped = useMemo(() => {
    const map = new Map<string, typeof allExpenses>()
    for (const e of visibleExpenses) {
      const d = new Date(e.date)
      const key = mode === "months"
        ? format(d, "LLLL yyyy", { locale: cs })
        : `${d.getFullYear()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [visibleExpenses, mode])

  // Period label in header
  const periodLabel = useMemo(() => {
    if (mode === "months") return `${year}`
    if (mode === "years") return "Roční přehled"
    return "Celé období"
  }, [mode, year])

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-exo2)" }}>
          Náklady
        </h1>
        {/* Mode switcher */}
        <div className="flex rounded-xl overflow-hidden border border-border text-xs font-semibold">
          {(["months", "years", "all"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelectedBucket(null) }}
              className={`px-3 py-1.5 transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "months" ? "Měsíce" : m === "years" ? "Roky" : "Vše"}
            </button>
          ))}
        </div>
      </div>

      {/* Year navigation (months mode only) */}
      {mode === "months" && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setYear((y) => y - 1); setSelectedBucket(null) }}
            disabled={year <= minYear}
            className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold">{year}</span>
          <button
            onClick={() => { setYear((y) => y + 1); setSelectedBucket(null) }}
            disabled={year >= maxYear}
            className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Summary pills */}
      {totalAll > 0 && (
        <div className="flex gap-2 flex-wrap text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-card border border-border">
            Celkem <strong>{fmtCzk(totalAll)}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-fuel-muted border border-fuel/20">
            Palivo <strong>{fmtCzk(totalFuel)}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-secondary border border-border">
            Fixní <strong>{fmtCzk(totalFixed)}</strong>
          </span>
        </div>
      )}

      {/* Bar chart */}
      {data === undefined ? (
        <div className="h-44 rounded-xl bg-card animate-pulse" />
      ) : buckets.length === 0 ? (
        <div className="h-44 rounded-xl border border-dashed border-border flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Žádné záznamy v tomto období</p>
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border p-4">
          {selectedBucket && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">
                Zobrazeno: <strong className="text-foreground">{bucketLabel(selectedBucket, mode)}</strong>
              </span>
              <button
                onClick={() => setSelectedBucket(null)}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Zobrazit vše ×
              </button>
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-fuel inline-block" />
              Palivo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />
              Variabilní
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/40 inline-block" />
              Fixní
            </span>
          </div>

          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={buckets}
              margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
              barCategoryGap="25%"
              onClick={(d) => {
                if (d?.activeLabel) {
                  const clicked = buckets.find((b) => b.key === d.activeLabel)?.key
                  setSelectedBucket((prev) => (prev === clicked ? null : (clicked ?? null)))
                }
              }}
            >
              <XAxis
                dataKey="key"
                tickFormatter={(k) => bucketLabel(k, mode)}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const b = buckets.find((x) => x.key === label)
                  if (!b) return null
                  return (
                    <div className="bg-popover border border-border rounded-xl p-3 text-xs shadow-lg space-y-1">
                      <p className="font-semibold text-sm mb-1">
                        {bucketLabel(label, mode)}
                      </p>
                      <p className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Palivo</span>
                        <strong>{fmtCzk(b.fuel)}</strong>
                      </p>
                      <p className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Variabilní</span>
                        <strong>{fmtCzk(b.variable)}</strong>
                      </p>
                      <p className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Fixní</span>
                        <strong>{fmtCzk(b.fixed)}</strong>
                      </p>
                      <div className="border-t border-border mt-1 pt-1 flex justify-between gap-4">
                        <span className="text-muted-foreground">Celkem</span>
                        <strong>{fmtCzk(b.total)}</strong>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="fuel" stackId="a" radius={[0, 0, 0, 0]}>
                {buckets.map((b) => (
                  <Cell
                    key={b.key}
                    fill={
                      selectedBucket && selectedBucket !== b.key
                        ? "var(--fuel-muted)"
                        : "hsl(var(--fuel))"
                    }
                  />
                ))}
              </Bar>
              <Bar dataKey="variable" stackId="a">
                {buckets.map((b) => (
                  <Cell
                    key={b.key}
                    fill={
                      selectedBucket && selectedBucket !== b.key
                        ? "hsl(var(--primary) / 0.2)"
                        : "hsl(var(--primary) / 0.7)"
                    }
                  />
                ))}
              </Bar>
              <Bar dataKey="fixed" stackId="a" radius={[4, 4, 0, 0]}>
                {buckets.map((b) => (
                  <Cell
                    key={b.key}
                    fill={
                      selectedBucket && selectedBucket !== b.key
                        ? "hsl(var(--muted-foreground) / 0.15)"
                        : "hsl(var(--muted-foreground) / 0.35)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats grid for visible period */}
      {data !== undefined && visibleExpenses.length > 0 && (
        <CostStatsGrid expenses={visibleExpenses} />
      )}

      {/* Expense table grouped */}
      {data !== undefined && visibleExpenses.length > 0 && (
        <div className="space-y-4">
          {Array.from(grouped.entries()).reverse().map(([groupLabel, expenses]) => {
            const groupTotal = expenses.reduce((s, e) => s + e.amountCzk, 0)
            return (
              <div key={groupLabel}>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-sm font-semibold capitalize"
                    style={{ fontFamily: "var(--font-exo2)" }}
                  >
                    {groupLabel}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">
                    {fmtCzk(groupTotal)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {[...expenses].sort((a, b) => b.date - a.date).map((e) => {
                    const Icon = TYPE_ICONS[e.type] ?? Receipt
                    const isVariable = VARIABLE_TYPES.includes(e.type)
                    return (
                      <div
                        key={e._id}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-card border border-border"
                      >
                        <div
                          className={`w-8 h-8 flex items-center justify-center shrink-0 ${
                            (TYPE_COLORS[e.type] ?? TYPE_COLORS.expense).bg
                          } rounded-lg`}
                        >
                          <Icon
                            className={`w-3.5 h-3.5 ${
                              (TYPE_COLORS[e.type] ?? TYPE_COLORS.expense).icon
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-none">
                            {e.type === "fuel" && e.fuelSubtype
                              ? FUEL_SUBTYPE_LABELS[e.fuelSubtype]
                              : (TYPE_LABELS[e.type] ?? e.type)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(e.date), "d. M.", { locale: cs })}
                            {e.note && <> · {e.note}</>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{fmtCzk(e.amountCzk)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {isVariable ? "variabilní" : "fixní"}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {data !== undefined && visibleExpenses.length === 0 && buckets.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Zatím žádné záznamy. Přidejte první výdaj.
        </p>
      )}
    </div>
  )
}

// ─── Stats grid computed from the currently visible expenses ─────────────────

type FuelSubtype = "benzin" | "nafta" | "elektrina"

const FUEL_SUBTYPE_LABELS: Record<FuelSubtype, string> = {
  benzin: "Benzín",
  nafta: "Nafta",
  elektrina: "Elektřina",
}

type AnyExpense = {
  _id: string
  amountCzk: number
  type: string
  date: number
  liters?: number
  distanceKm?: number
  needsReview?: boolean
  fuelSubtype?: FuelSubtype
  note?: string
}

function CostStatsGrid({ expenses }: { expenses: AnyExpense[] }) {
  const fuelExpenses = expenses.filter((e) => e.type === "fuel")
  const variableTypes = ["fuel", "car_wash", "other", "expense", "tires"]

  const fuelTotal = fuelExpenses.reduce((s, e) => s + e.amountCzk, 0)
  const totalCost = expenses.reduce((s, e) => s + e.amountCzk, 0)
  const distanceTotal = fuelExpenses.reduce((s, e) => s + (e.distanceKm ?? 0), 0)

  const fuelWithDist = fuelExpenses.filter(
    (e) => e.liters != null && e.distanceKm != null && e.distanceKm > 0 && !e.needsReview
  )
  const totalLiters = fuelWithDist.reduce((s, e) => s + (e.liters ?? 0), 0)
  const totalDistForAvg = fuelWithDist.reduce((s, e) => s + (e.distanceKm ?? 0), 0)
  const avgConsumption = totalDistForAvg > 0 ? (totalLiters / totalDistForAvg) * 100 : null

  const variableCost = expenses
    .filter((e) => variableTypes.includes(e.type))
    .reduce((s, e) => s + e.amountCzk, 0)
  const costPerKm = distanceTotal > 0 ? totalCost / distanceTotal : null
  const costPerKmVariable = distanceTotal > 0 ? variableCost / distanceTotal : null

  const stats = [
    {
      icon: Fuel,
      label: "Pohonné hmoty",
      value: fmtCzk(fuelTotal),
      bg: "bg-fuel-muted",
      iconCls: "text-fuel",
    },
    {
      icon: Coins,
      label: "Celkové náklady",
      value: fmtCzk(totalCost),
      bg: "bg-primary/10",
      iconCls: "text-primary",
    },
    {
      icon: Route,
      label: "Celková vzdálenost",
      value: distanceTotal > 0 ? `${Math.round(distanceTotal).toLocaleString("cs-CZ")} km` : "–",
      bg: "bg-sky-500/10",
      iconCls: "text-sky-400",
    },
    {
      icon: Gauge,
      label: "Průměrná spotřeba",
      value: avgConsumption != null ? `${fmt(avgConsumption)} l/100 km` : "–",
      bg: "bg-warning/10",
      iconCls: "text-warning",
    },
    {
      icon: TrendingDown,
      label: "Náklady / km (celkem)",
      value: costPerKm != null ? `${fmt(costPerKm, 2)} Kč/km` : "–",
      bg: "bg-orange-500/10",
      iconCls: "text-orange-400",
    },
    {
      icon: Zap,
      label: "Náklady / km (variabilní)",
      value: costPerKmVariable != null ? `${fmt(costPerKmVariable, 2)} Kč/km` : "–",
      bg: "bg-emerald-500/10",
      iconCls: "text-emerald-400",
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {stats.map(({ icon: Icon, label, value, bg, iconCls }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className={`rounded-lg p-2 shrink-0 ${bg}`}>
            <Icon className={`w-4 h-4 ${iconCls}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            <p className="text-sm font-semibold leading-tight truncate">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
