"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import Link from "next/link"
import { format } from "date-fns"
import { cs } from "date-fns/locale"
import { useState } from "react"
import {
  Fuel,
  Plus,
  AlertTriangle,
  Receipt,
  Wrench,
  CreditCard,
  Bell,
  CalendarCheck,
  Shield,
  Layers,
  CheckCircle,
  ClipboardList,
  RotateCcw,
  ChevronDown,
  BadgeCheck,
  ExternalLink,
} from "lucide-react"

interface Props {
  vehicleId: Id<"vehicles">
}

function fmtCzk(n: number | null | undefined) {
  if (n == null) return "–"
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtNum(n: number, dec = 1) {
  return n.toFixed(dec).replace(".", ",")
}

export function DashboardContent({ vehicleId }: Props) {
  const recentExpenses = useQuery(api.expenses.listExpenses, {
    vehicleId,
    limit: 8,
  })
  const vehicle = useQuery(api.vehicles.getVehicle, { vehicleId })
  const upcomingReminders = useQuery(api.vehicles.getUpcomingReminders, { vehicleId })
  const fuelNeedsReview = useQuery(api.expenses.listNeedsReviewFuel, { vehicleId })
  const dismissedTasks = useQuery(api.vehicles.listDismissedTasks, { vehicleId })
  const vignettes = useQuery(api.vignettes.listVignettes, { vehicleId })
  const dismissTask = useMutation(api.vehicles.dismissTask)
  const restoreTask = useMutation(api.vehicles.restoreTask)
  const [showDismissed, setShowDismissed] = useState(false)

  // Vignettes that need attention (expiring or expired)
  const alertVignettes = (vignettes ?? []).filter(
    (v) => v.status === "expiring_soon" || v.status === "expired"
  )

  const now = new Date()
  const monthLabel = format(now, "LLLL yyyy", { locale: cs })

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">{monthLabel}</p>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-exo2)" }}
        >
          {vehicle?.name ?? "Přehled"}
        </h1>
      </div>

      {/* Úkoly k řešení: reminders + fuel with needsReview + vignettes */}
      {((upcomingReminders && upcomingReminders.length > 0) || (fuelNeedsReview && fuelNeedsReview.length > 0) || alertVignettes.length > 0) && (
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <ClipboardList className="w-4 h-4" />
            <h2
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: "var(--font-exo2)" }}
            >
              Úkoly k řešení
            </h2>
          </div>
          <div className="space-y-2">
            {fuelNeedsReview?.map((expense) => (
              <FuelReviewRow
                key={expense._id}
                expense={expense}
                vehicleId={vehicleId}
                onDismiss={() =>
                  dismissTask({ vehicleId, type: "fuel", dueKey: expense._id })
                }
              />
            ))}
            {upcomingReminders?.map((r) => (
              <ReminderFeedRow
                key={r.type}
                reminder={r}
                vehicleId={vehicleId}
                onDismiss={() =>
                  dismissTask({ vehicleId, type: r.type, dueKey: String(r.dueDate) })
                }
              />
            ))}
            {alertVignettes.map((v) => (
              <VignetteAlertRow key={v._id} vignette={v} vehicleId={vehicleId} />
            ))}
          </div>
        </div>
      )}

      {/* Dismissed tasks — restore option */}
      {dismissedTasks && dismissedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowDismissed((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDismissed ? "rotate-180" : ""}`} />
            Skryté úkoly ({dismissedTasks.length})
          </button>
          {showDismissed && (
            <div className="mt-2 space-y-1.5">
              {dismissedTasks.map((t) => (
                <DismissedTaskRow
                  key={t._id}
                  task={t}
                  onRestore={() => restoreTask({ vehicleId, type: t.type, dueKey: t.dueKey })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent expenses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: "var(--font-exo2)" }}
          >
            Poslední záznamy
          </h2>
          <Link
            href={`/app/v/${vehicleId}/expenses`}
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Vše →
          </Link>
        </div>

        {recentExpenses === undefined ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : recentExpenses.length === 0 ? (
          <EmptyState vehicleId={vehicleId} />
        ) : (
          <div className="space-y-2">
            {recentExpenses.slice(0, 5).map((expense) => (
              <ExpenseRow key={expense._id} expense={expense} vehicleId={vehicleId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ExpenseRow({
  expense,
  vehicleId,
}: {
  expense: any
  vehicleId: Id<"vehicles">
}) {
  const typeLabel: Record<string, string> = {
    fuel: "Tankování",
    car_wash: "Výdaje",
    service: "Servis",
    tires: "Výdaje",
    insurance: "Výdaje",
    installment: "Pořízení / splátka",
    other: "Výdaje",
    expense: "Výdaje",
  }

  const typeConfig: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
    fuel:        { icon: Fuel,       bg: "bg-fuel-muted",        color: "text-fuel" },
    service:     { icon: Wrench,     bg: "bg-warning/10",        color: "text-warning" },
    installment: { icon: CreditCard, bg: "bg-orange-500/10",     color: "text-orange-400" },
    car_wash:    { icon: Receipt,    bg: "bg-sky-500/10",        color: "text-sky-400" },
    tires:       { icon: Receipt,    bg: "bg-sky-500/10",        color: "text-sky-400" },
    insurance:   { icon: Receipt,    bg: "bg-sky-500/10",        color: "text-sky-400" },
    other:       { icon: Receipt,    bg: "bg-sky-500/10",        color: "text-sky-400" },
    expense:     { icon: Receipt,    bg: "bg-sky-500/10",        color: "text-sky-400" },
  }

  const cfg = typeConfig[expense.type] ?? typeConfig.expense
  const Icon = cfg.icon

  return (
    <Link
      href={`/app/v/${vehicleId}/expenses/${expense._id}`}
      className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-border/80 hover:bg-secondary/40 transition-all"
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} ${
          expense.type === "service" ? "border border-warning/40" : ""
        }`}
      >
        <Icon className={`w-4 h-4 ${cfg.color}`} />
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
          {format(new Date(expense.date), "d. M. yyyy", { locale: cs })}
          {expense.type === "fuel" && expense.liters && (
            <> · {fmtNum(expense.liters, 2)} l</>
          )}
          {expense.type === "fuel" && expense.consumptionLPer100 && (
            <> · {fmtNum(expense.consumptionLPer100)} l/100km</>
          )}
        </p>
      </div>

      <span className="text-sm font-semibold text-right shrink-0">
        {new Intl.NumberFormat("cs-CZ", {
          style: "currency",
          currency: "CZK",
          maximumFractionDigits: 0,
        }).format(expense.amountCzk)}
      </span>
    </Link>
  )
}

const TASK_LABELS: Record<string, string> = {
  stk: "STK",
  insurance: "Pojistka",
  service: "Servis",
  tires: "Přezutí",
  fuel: "Tankování — zkontrolovat",
}

function DismissedTaskRow({
  task,
  onRestore,
}: {
  task: { _id: string; type: string; dueKey: string; dismissedAt: number }
  onRestore: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleRestore() {
    setLoading(true)
    try {
      await onRestore()
    } finally {
      setLoading(false)
    }
  }

  const label = TASK_LABELS[task.type] ?? task.type
  const dismissedStr = new Date(task.dismissedAt).toLocaleDateString("cs-CZ")

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-card/50 border border-border/50">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-muted-foreground line-through">{label}</span>
        <p className="text-xs text-muted-foreground/60">Odkliknuto {dismissedStr}</p>
      </div>
      <button
        onClick={handleRestore}
        disabled={loading}
        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
        title="Obnovit úkol"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Obnovit
      </button>
    </div>
  )
}

function FuelReviewRow({
  expense,
  vehicleId,
  onDismiss,
}: {
  expense: any
  vehicleId: Id<"vehicles">
  onDismiss: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleOk(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onDismiss()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-warning/30 hover:border-warning/50 transition-all">
      <Link
        href={`/app/v/${vehicleId}/expenses/${expense._id}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-warning/10">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium">Tankování — zkontrolovat</span>
            <span className="text-xs font-semibold rounded-md px-2 py-0.5 bg-warning/15 text-warning">!</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(expense.date), "d. M. yyyy", { locale: cs })}
            {expense.liters && <> · {expense.liters.toFixed(2).replace(".", ",")} l</>}
            {expense.consumptionLPer100 && <> · {expense.consumptionLPer100.toFixed(1).replace(".", ",")} l/100km</>}
          </p>
        </div>
      </Link>
      <button
        onClick={handleOk}
        disabled={loading}
        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-colors disabled:opacity-50"
        title="Označit jako zkontrolované"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        OK
      </button>
    </div>
  )
}

function ReminderFeedRow({
  reminder,
  vehicleId,
  onDismiss,
}: {
  reminder: { type: string; label: string; daysLeft: number; dueDate: number }
  vehicleId: Id<"vehicles">
  onDismiss: () => void
}) {
  const iconMap: Record<string, React.ElementType> = {
    stk: CalendarCheck,
    insurance: Shield,
    service: Wrench,
    tires: Layers,
  }
  const Icon = iconMap[reminder.type] ?? Bell

  const urgency =
    reminder.daysLeft < 0
      ? "red"
      : reminder.daysLeft <= 14
      ? "red"
      : reminder.daysLeft <= 30
      ? "yellow"
      : "green"

  const badgeCls =
    urgency === "red"
      ? "bg-destructive/15 text-destructive"
      : urgency === "yellow"
      ? "bg-warning/15 text-warning"
      : "bg-success/15 text-success"

  const badgeLabel =
    reminder.daysLeft < 0
      ? "Prošlé"
      : reminder.daysLeft === 0
      ? "Dnes!"
      : `za ${reminder.daysLeft} dní`

  const dueStr = new Date(reminder.dueDate).toLocaleDateString("cs-CZ")
  const [loading, setLoading] = useState(false)

  async function handleOk(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onDismiss()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-border/80 transition-all">
      <Link
        href={`/app/v/${vehicleId}/vehicle`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${urgency === "red" ? "bg-destructive/10" : urgency === "yellow" ? "bg-warning/10" : "bg-success/10"}`}>
          <Icon className={`w-4 h-4 ${urgency === "red" ? "text-destructive" : urgency === "yellow" ? "text-warning" : "text-success"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{reminder.label}</span>
            <span className={`text-xs font-semibold rounded-md px-2 py-0.5 ${badgeCls}`}>{badgeLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground">{dueStr}</p>
        </div>
      </Link>
      <button
        onClick={handleOk}
        disabled={loading}
        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-colors disabled:opacity-50"
        title="Označit jako vyřešené"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        OK
      </button>
    </div>
  )
}

function VignetteAlertRow({
  vignette,
  vehicleId,
}: {
  vignette: { _id: string; country: string; licensePlate: string; validUntil: number; status: string; daysLeft: number; type: string }
  vehicleId: Id<"vehicles">
}) {
  const days = vignette.daysLeft
  const isExpired = vignette.status === "expired"

  const COUNTRY_LABELS: Record<string, string> = {
    CZ: "ČR", SK: "SK", AT: "AT", DE: "DE", PL: "PL", HU: "HU",
  }

  const daysLabel = isExpired
    ? "Expirováno"
    : `Vyprší za ${days} ${days === 1 ? "den" : days < 5 ? "dny" : "dní"}`

  return (
    <Link
      href={`/app/v/${vehicleId}/vehicle`}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors hover:bg-secondary/40 ${
        isExpired
          ? "bg-destructive/5 border-destructive/30"
          : "bg-warning/5 border-warning/30"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isExpired ? "bg-destructive/15" : "bg-warning/15"
        }`}
      >
        <BadgeCheck className={`w-4 h-4 ${isExpired ? "text-destructive" : "text-warning"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          Dálniční známka {COUNTRY_LABELS[vignette.country] ?? vignette.country}
        </p>
        <p className={`text-xs mt-0.5 ${isExpired ? "text-destructive" : "text-warning"}`}>
          {daysLabel} · SPZ {vignette.licensePlate}
        </p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    </Link>
  )
}

function EmptyState({ vehicleId }: { vehicleId: Id<"vehicles"> }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <Fuel className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground mb-4">
        Žádné záznamy. Přidejte první tankování!
      </p>
      <Link
        href={`/app/v/${vehicleId}/expenses/new`}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Přidat výdaj
      </Link>
    </div>
  )
}
