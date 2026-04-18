"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import {
  Bell,
  Shield,
  Wrench,
  Layers,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  CalendarCheck,
} from "lucide-react"

interface VehicleData {
  _id: Id<"vehicles">
  firstRegistrationDate?: number
  stkDate?: number
  insuranceExpiryDate?: number
  serviceKmInterval?: number
  serviceLastKm?: number
  serviceLastDate?: number
  tiresSpringMonth?: number
  tiresAutumnMonth?: number
  notifyStkDays?: number
  notifyInsuranceDays?: number
  notifyServiceDays?: number
  notifyTiresDays?: number
}

interface Props {
  vehicle: VehicleData
  isOwner: boolean
}

// ─── STK calculation helpers ────────────────────────────────────────────────

function calcNextStkFromReg(firstRegTs: number): Date {
  const regDate = new Date(firstRegTs)
  // First STK is 4 years after first registration
  const firstStk = new Date(regDate)
  firstStk.setFullYear(firstStk.getFullYear() + 4)
  // Subsequent STKs every 2 years — find next one in the future
  const now = new Date()
  let nextStk = new Date(firstStk)
  while (nextStk <= now) {
    nextStk = new Date(nextStk)
    nextStk.setFullYear(nextStk.getFullYear() + 2)
  }
  return nextStk
}

function daysUntil(ts: number): number {
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24))
}

function statusColor(days: number): "green" | "yellow" | "red" {
  if (days > 90) return "green"
  if (days > 30) return "yellow"
  return "red"
}

function StatusBadge({ days }: { days: number }) {
  const color = statusColor(days)
  const label =
    days < 0
      ? "Prošlé"
      : days === 0
      ? "Dnes!"
      : `za ${days} dní`

  const cls =
    color === "green"
      ? "bg-success/15 text-success"
      : color === "yellow"
      ? "bg-warning/15 text-warning"
      : "bg-destructive/15 text-destructive"

  return (
    <span className={`text-xs font-semibold rounded-md px-2 py-0.5 ${cls}`}>
      {label}
    </span>
  )
}

function tsToDateInput(ts: number | undefined): string {
  if (!ts) return ""
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function dateInputToTs(s: string): number | undefined {
  if (!s) return undefined
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d.getTime()
}

const MONTH_NAMES = [
  "", "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
]

// ─── Main component ──────────────────────────────────────────────────────────

export function VehicleRemindersSection({ vehicle, isOwner }: Props) {
  const updateDetails = useMutation(api.vehicles.updateVehicleDetails)

  const [openCard, setOpenCard] = useState<string | null>(null)

  function toggleCard(id: string) {
    setOpenCard((prev) => (prev === id ? null : id))
  }

  // Calculate effective STK date
  const stkDateTs = vehicle.stkDate
    ?? (vehicle.firstRegistrationDate
      ? calcNextStkFromReg(vehicle.firstRegistrationDate).getTime()
      : undefined)
  const stkIsCalculated = !vehicle.stkDate && !!vehicle.firstRegistrationDate

  // Tire swap: next occurrence of spring or autumn month
  function nextTireSwapDate(month: number): Date {
    const now = new Date()
    const d = new Date(now.getFullYear(), month - 1, 1)
    if (d <= now) d.setFullYear(d.getFullYear() + 1)
    return d
  }

  const springMonth = vehicle.tiresSpringMonth ?? 4
  const autumnMonth = vehicle.tiresAutumnMonth ?? 10
  const nextSpring = nextTireSwapDate(springMonth)
  const nextAutumn = nextTireSwapDate(autumnMonth)
  const nextTires = nextSpring < nextAutumn ? nextSpring : nextAutumn
  const nextTiresLabel = nextSpring < nextAutumn ? "letní" : "zimní"

  return (
    <div>
      <div className="flex items-center gap-2 text-muted-foreground mb-3">
        <Bell className="w-4 h-4" />
        <h2 className="text-sm font-semibold uppercase tracking-wide">Výročí</h2>
      </div>

      <div className="space-y-2">
        {/* STK */}
        <ReminderCard
          id="stk"
          icon={<CalendarCheck className="w-4 h-4" />}
          title="STK"
          open={openCard === "stk"}
          onToggle={() => toggleCard("stk")}
          status={
            stkDateTs ? (
              <StatusBadge days={daysUntil(stkDateTs)} />
            ) : (
              <span className="text-xs text-muted-foreground">Nenastaveno</span>
            )
          }
          subtitle={
            stkDateTs
              ? `${new Date(stkDateTs).toLocaleDateString("cs-CZ")}${stkIsCalculated ? " (odhadnuto)" : ""}`
              : undefined
          }
          isOwner={isOwner}
        >
          <StkEditForm
            vehicle={vehicle}
            stkDateTs={stkDateTs}
            stkIsCalculated={stkIsCalculated}
            onSave={async (patch) => {
              await updateDetails({ vehicleId: vehicle._id, ...patch })
              setOpenCard(null)
            }}
          />

        </ReminderCard>

        {/* Insurance */}
        <ReminderCard
          id="insurance"
          icon={<Shield className="w-4 h-4" />}
          title="Pojistka"
          open={openCard === "insurance"}
          onToggle={() => toggleCard("insurance")}
          status={
            vehicle.insuranceExpiryDate ? (
              <StatusBadge days={daysUntil(vehicle.insuranceExpiryDate)} />
            ) : (
              <span className="text-xs text-muted-foreground">Nenastaveno</span>
            )
          }
          subtitle={
            vehicle.insuranceExpiryDate
              ? new Date(vehicle.insuranceExpiryDate).toLocaleDateString("cs-CZ")
              : undefined
          }
          isOwner={isOwner}
        >
          <DateEditForm
            label="Datum vypršení pojistky"
            dateTs={vehicle.insuranceExpiryDate}
            notifyDaysDefault={vehicle.notifyInsuranceDays ?? 60}
            onSave={async (ts, notifyDays) => {
              await updateDetails({ vehicleId: vehicle._id, insuranceExpiryDate: ts, notifyInsuranceDays: notifyDays })
              setOpenCard(null)
            }}
          />
        </ReminderCard>

        {/* Service */}
        <ReminderCard
          id="service"
          icon={<Wrench className="w-4 h-4" />}
          title="Servis"
          open={openCard === "service"}
          onToggle={() => toggleCard("service")}
          status={
            vehicle.serviceKmInterval && vehicle.serviceLastKm ? (
              <span className="text-xs font-semibold text-primary">
                při {(vehicle.serviceLastKm + vehicle.serviceKmInterval).toLocaleString("cs-CZ")} km
              </span>
            ) : vehicle.serviceLastDate ? (
              <span className="text-xs text-muted-foreground">
                {new Date(vehicle.serviceLastDate).toLocaleDateString("cs-CZ")}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Nenastaveno</span>
            )
          }
          subtitle={
            vehicle.serviceKmInterval
              ? `každých ${vehicle.serviceKmInterval.toLocaleString("cs-CZ")} km`
              : undefined
          }
          isOwner={isOwner}
        >
          <ServiceEditForm
            vehicle={vehicle}
            onSave={async (patch) => {
              await updateDetails({ vehicleId: vehicle._id, ...patch })
              setOpenCard(null)
            }}
          />

        </ReminderCard>

        {/* Tires */}
        <ReminderCard
          id="tires"
          icon={<Layers className="w-4 h-4" />}
          title="Přezutí"
          open={openCard === "tires"}
          onToggle={() => toggleCard("tires")}
          status={
            <StatusBadge days={daysUntil(nextTires.getTime())} />
          }
          subtitle={`${nextTiresLabel === "letní" ? "Letní" : "Zimní"} pneumatiky — ${nextTires.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })}`}
          isOwner={isOwner}
        >
          <TiresEditForm
            springMonth={vehicle.tiresSpringMonth ?? 4}
            autumnMonth={vehicle.tiresAutumnMonth ?? 10}
            notifyDaysDefault={vehicle.notifyTiresDays ?? 30}
            onSave={async (spring, autumn, notifyDays) => {
              await updateDetails({
                vehicleId: vehicle._id,
                tiresSpringMonth: spring,
                tiresAutumnMonth: autumn,
                notifyTiresDays: notifyDays,
              })
              setOpenCard(null)
            }}
          />
        </ReminderCard>
      </div>
    </div>
  )
}

// ─── Reminder card ────────────────────────────────────────────────────────────

function ReminderCard({
  id,
  icon,
  title,
  open,
  onToggle,
  status,
  subtitle,
  isOwner,
  children,
}: {
  id: string
  icon: React.ReactNode
  title: string
  open: boolean
  onToggle: () => void
  status: React.ReactNode
  subtitle?: string
  isOwner: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={isOwner ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isOwner ? "hover:bg-secondary/30 transition-colors" : ""}`}
      >
        <div className="text-muted-foreground shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{title}</span>
            {status}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {isOwner && (
          <div className="text-muted-foreground shrink-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        )}
      </button>

      {open && isOwner && (
        <div className="border-t border-border px-4 py-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Edit forms ───────────────────────────────────────────────────────────────

function StkEditForm({
  vehicle,
  stkDateTs,
  stkIsCalculated,
  onSave,
}: {
  vehicle: VehicleData
  stkDateTs: number | undefined
  stkIsCalculated: boolean
  onSave: (patch: { stkDate?: number; firstRegistrationDate?: number; notifyStkDays?: number }) => Promise<void>
}) {
  const [stkDate, setStkDate] = useState(tsToDateInput(vehicle.stkDate))
  const [firstRegDate, setFirstRegDate] = useState(tsToDateInput(vehicle.firstRegistrationDate))
  const [notifyDays, setNotifyDays] = useState((vehicle.notifyStkDays ?? 60).toString())
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        stkDate: dateInputToTs(stkDate),
        firstRegistrationDate: dateInputToTs(firstRegDate),
        notifyStkDays: notifyDays ? Number(notifyDays) : undefined,
      })
      toast.success("STK uloženo")
    } catch {
      toast.error("Chyba při ukládání")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">
          Datum první registrace
        </label>
        <input
          type="date"
          value={firstRegDate}
          onChange={(e) => setFirstRegDate(e.target.value)}
          className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Použijeme pro výpočet termínu STK (1. za 4 roky, pak každé 2 roky)
        </p>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">
          Přepsat datum STK
          {stkIsCalculated && stkDateTs && (
            <span className="ml-1 text-muted-foreground/60">
              (odhadnuto: {new Date(stkDateTs).toLocaleDateString("cs-CZ")})
            </span>
          )}
        </label>
        <input
          type="date"
          value={stkDate}
          onChange={(e) => setStkDate(e.target.value)}
          className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Nechte prázdné pro automatický výpočet z data registrace
        </p>
      </div>
      <NotifyDaysField value={notifyDays} onChange={setNotifyDays} />
      <SaveButton saving={saving} onClick={handleSave} />
    </div>
  )
}

function DateEditForm({
  label,
  dateTs,
  notifyDaysDefault,
  onSave,
}: {
  label: string
  dateTs: number | undefined
  notifyDaysDefault?: number
  onSave: (ts: number | undefined, notifyDays?: number) => Promise<void>
}) {
  const [dateVal, setDateVal] = useState(tsToDateInput(dateTs))
  const [notifyDays, setNotifyDays] = useState((notifyDaysDefault ?? 60).toString())
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(dateInputToTs(dateVal), notifyDays ? Number(notifyDays) : undefined)
      toast.success("Uloženo")
    } catch {
      toast.error("Chyba při ukládání")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">{label}</label>
        <input
          type="date"
          value={dateVal}
          onChange={(e) => setDateVal(e.target.value)}
          className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <NotifyDaysField value={notifyDays} onChange={setNotifyDays} />
      <SaveButton saving={saving} onClick={handleSave} />
    </div>
  )
}

function ServiceEditForm({
  vehicle,
  onSave,
}: {
  vehicle: VehicleData
  onSave: (patch: {
    serviceKmInterval?: number
    serviceLastKm?: number
    serviceLastDate?: number
    notifyServiceDays?: number
  }) => Promise<void>
}) {
  const [interval, setInterval] = useState(vehicle.serviceKmInterval?.toString() ?? "")
  const [lastKm, setLastKm] = useState(vehicle.serviceLastKm?.toString() ?? "")
  const [lastDate, setLastDate] = useState(tsToDateInput(vehicle.serviceLastDate))
  const [notifyDays, setNotifyDays] = useState((vehicle.notifyServiceDays ?? 60).toString())
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        serviceKmInterval: interval ? Number(interval) : undefined,
        serviceLastKm: lastKm ? Number(lastKm) : undefined,
        serviceLastDate: dateInputToTs(lastDate),
        notifyServiceDays: notifyDays ? Number(notifyDays) : undefined,
      })
      toast.success("Servisní interval uložen")
    } catch {
      toast.error("Chyba při ukládání")
    } finally {
      setSaving(false)
    }
  }

  const nextServiceKm =
    interval && lastKm
      ? (Number(lastKm) + Number(interval)).toLocaleString("cs-CZ") + " km"
      : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Interval (km)</label>
          <input
            type="number"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            placeholder="15000"
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Poslední servis (km)</label>
          <input
            type="number"
            value={lastKm}
            onChange={(e) => setLastKm(e.target.value)}
            placeholder="54000"
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">Datum posledního servisu</label>
        <input
          type="date"
          value={lastDate}
          onChange={(e) => setLastDate(e.target.value)}
          className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      {nextServiceKm && (
        <p className="text-xs text-primary font-medium">
          Příští servis při: {nextServiceKm}
        </p>
      )}
      <NotifyDaysField value={notifyDays} onChange={setNotifyDays} />
      <SaveButton saving={saving} onClick={handleSave} />
    </div>
  )
}

function TiresEditForm({
  springMonth,
  autumnMonth,
  notifyDaysDefault,
  onSave,
}: {
  springMonth: number
  autumnMonth: number
  notifyDaysDefault: number
  onSave: (spring: number, autumn: number, notifyDays: number) => Promise<void>
}) {
  const [spring, setSpring] = useState(springMonth)
  const [autumn, setAutumn] = useState(autumnMonth)
  const [notifyDays, setNotifyDays] = useState(notifyDaysDefault.toString())
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(spring, autumn, notifyDays ? Number(notifyDays) : 30)
      toast.success("Termíny přezutí uloženy")
    } catch {
      toast.error("Chyba při ukládání")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">
            🌸 Přezutí na letní
          </label>
          <select
            value={spring}
            onChange={(e) => setSpring(Number(e.target.value))}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {MONTH_NAMES.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">
            ❄️ Přezutí na zimní
          </label>
          <select
            value={autumn}
            onChange={(e) => setAutumn(Number(e.target.value))}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {MONTH_NAMES.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      <NotifyDaysField value={notifyDays} onChange={setNotifyDays} />
      <SaveButton saving={saving} onClick={handleSave} />
    </div>
  )
}

function NotifyDaysField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1.5">
        Upozornit e-mailem před termínem (dny)
      </label>
      <input
        type="number"
        min="1"
        max="365"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  )
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
    >
      {saving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <Check className="w-4 h-4" />
          Uložit
        </>
      )}
    </button>
  )
}
