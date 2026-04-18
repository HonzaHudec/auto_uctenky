"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import {
  BadgeCheck,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  MapPin,
  CalendarClock,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type VignetteType = "1_day" | "10_day" | "30_day" | "365_day"
type VignetteStatus = "active" | "expiring_soon" | "expired"

const TYPE_LABELS: Record<VignetteType, string> = {
  "1_day": "1denní",
  "10_day": "10denní",
  "30_day": "30denní",
  "365_day": "365denní",
}

const TYPE_DAYS: Record<VignetteType, number> = {
  "1_day": 1,
  "10_day": 10,
  "30_day": 30,
  "365_day": 365,
}

const COUNTRY_LABELS: Record<string, string> = {
  CZ: "Česká republika",
  SK: "Slovensko",
  AT: "Rakousko",
  DE: "Německo",
  PL: "Polsko",
  HU: "Maďarsko",
}

const COUNTRY_PURCHASE_URLS: Record<string, string> = {
  CZ: "https://edalnice.cz/jednoduchy-nakup/index.html#/eshop/order/license",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysLeft(ts: number): number {
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24))
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
}

function toDateInputValue(ts: number): string {
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function dateInputToStartOfDay(s: string): number {
  if (!s) return 0
  // Parse as local date (midnight)
  const [yyyy, mm, dd] = s.split("-").map(Number)
  return new Date(yyyy, mm - 1, dd).getTime()
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, days }: { status: VignetteStatus; days: number }) {
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30">
        Expirováno
      </span>
    )
  }
  if (status === "expiring_soon") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-warning/15 text-warning border border-warning/30">
        Vyprší za {days} {days === 1 ? "den" : days < 5 ? "dny" : "dní"}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-success/15 text-success border border-success/30">
      Platná · {days} {days < 5 ? "dny" : "dní"}
    </span>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  vehicleId: Id<"vehicles">
  vehicleSpz?: string
  isOwner: boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VehicleVignetteSection({ vehicleId, vehicleSpz, isOwner }: Props) {
  const vignettes = useQuery(api.vignettes.listVignettes, { vehicleId })
  const createVignette = useMutation(api.vignettes.createVignette)
  const deleteVignette = useMutation(api.vignettes.deleteVignette)

  const [showForm, setShowForm] = useState(false)
  const [copiedSpz, setCopiedSpz] = useState(false)
  const [deletingId, setDeletingId] = useState<Id<"vignettes"> | null>(null)
  const [expandedId, setExpandedId] = useState<Id<"vignettes"> | null>(null)

  // Form state
  const [form, setForm] = useState({
    country: "CZ",
    type: "365_day" as VignetteType,
    validFrom: toDateInputValue(Date.now()),
    licensePlate: vehicleSpz ?? "",
  })

  // Computed validUntil preview
  const validFromTs = dateInputToStartOfDay(form.validFrom)
  const validUntilTs = validFromTs
    ? validFromTs + TYPE_DAYS[form.type] * 24 * 60 * 60 * 1000 - 1
    : 0

  const [saving, setSaving] = useState(false)

  function handleCopySpz() {
    const spz = vehicleSpz ?? form.licensePlate
    if (!spz) return

    // Modern clipboard API with fallback to execCommand
    const doCopy = () => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(spz)
      }
      // Fallback for non-secure contexts or older browsers
      const ta = document.createElement("textarea")
      ta.value = spz
      ta.style.position = "fixed"
      ta.style.left = "-9999px"
      ta.style.top = "-9999px"
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(ta)
      if (!ok) throw new Error("execCommand failed")
      return Promise.resolve()
    }

    doCopy()
      .then(() => {
        setCopiedSpz(true)
        setTimeout(() => setCopiedSpz(false), 2000)
        toast.success("SPZ zkopírována do schránky")
      })
      .catch(() => {
        toast.error("Kopírování selhalo — zkopírujte SPZ ručně: " + spz)
      })
  }

  async function handleSave() {
    if (saving) return
    if (!form.validFrom) { toast.error("Vyplňte datum nákupu"); return }
    if (!form.licensePlate.trim()) { toast.error("Vyplňte SPZ"); return }

    setSaving(true)
    try {
      await createVignette({
        vehicleId,
        country: form.country,
        type: form.type,
        validFrom: validFromTs,
        licensePlate: form.licensePlate.trim().toUpperCase(),
      })
      toast.success("Dálniční známka přidána")
      setShowForm(false)
      // Reset form
      setForm((p) => ({ ...p, validFrom: toDateInputValue(Date.now()) }))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Chyba při ukládání")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: Id<"vignettes">) {
    setDeletingId(id)
    try {
      await deleteVignette({ vignetteId: id })
      toast.success("Známka smazána")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Chyba")
    } finally {
      setDeletingId(null)
    }
  }

  // Group by country
  type VignetteItem = NonNullable<typeof vignettes>[number]
  const grouped = (vignettes ?? []).reduce<Record<string, VignetteItem[]>>((acc, v) => {
    if (!acc[v.country]) acc[v.country] = []
    acc[v.country].push(v)
    return acc
  }, {})

  const purchaseUrl = COUNTRY_PURCHASE_URLS[form.country]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BadgeCheck className="w-4 h-4" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Dálniční známky</h2>
        </div>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Zrušit" : "Přidat"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl bg-card border border-border p-4 mb-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nová dálniční známka</p>

          {/* Country + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Země</label>
              <select
                value={form.country}
                onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="CZ">🇨🇿 ČR</option>
                <option value="SK">🇸🇰 SK</option>
                <option value="AT">🇦🇹 AT</option>
                <option value="HU">🇭🇺 HU</option>
                <option value="PL">🇵🇱 PL</option>
                <option value="DE">🇩🇪 DE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Typ</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as VignetteType }))}
                className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="1_day">1denní</option>
                <option value="10_day">10denní</option>
                <option value="30_day">30denní</option>
                <option value="365_day">365denní</option>
              </select>
            </div>
          </div>

          {/* Valid from + SPZ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Datum nákupu</label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))}
                className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">SPZ</label>
              <input
                type="text"
                value={form.licensePlate}
                onChange={(e) => setForm((p) => ({ ...p, licensePlate: e.target.value }))}
                placeholder="1AB 2345"
                className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 uppercase"
              />
            </div>
          </div>

          {/* Auto-computed validUntil preview */}
          {validFromTs > 0 && (
            <div className="rounded-lg bg-secondary/40 border border-border px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Platnost do</span>
              <span className="text-xs font-semibold text-foreground">{fmtDate(validUntilTs)}</span>
            </div>
          )}

          {/* eDalnice info box for CZ */}
          {form.country === "CZ" && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">Koupit na eDalnice.cz</p>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">SPZ vozidla</p>
                  <p className="text-sm font-semibold font-mono">{vehicleSpz || "—"}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySpz}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  {copiedSpz ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSpz ? "Zkopírováno" : "Kopírovat SPZ"}
                </button>
              </div>
              <a
                href={purchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Přejít na eDalnice.cz →
              </a>
              <p className="text-xs text-muted-foreground">
                Zadejte SPZ na eDalnice.cz, nakupte a pak sem zadejte datum nákupu.
              </p>
            </div>
          )}

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Uložit známku
          </button>
        </div>
      )}

      {/* Vignettes list */}
      {vignettes === undefined ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl bg-card border border-border p-5 text-center">
          <BadgeCheck className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Žádné dálniční známky</p>
          <p className="text-xs text-muted-foreground mt-0.5">Přidejte první pomocí tlačítka výše</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([country, countryVignettes]) => (
            <div key={country} className="rounded-xl bg-card border border-border overflow-hidden">
              {/* Country header */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/30 border-b border-border">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">
                  {COUNTRY_LABELS[country] ?? country}
                </span>
              </div>

              {/* Vignettes for this country */}
              <div className="divide-y divide-border">
                {countryVignettes.map((v) => {
                  const days = v.daysLeft
                  const isExpanded = expandedId === v._id

                  return (
                    <div key={v._id}>
                      {/* Row */}
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : v._id)}
                        className="w-full flex items-center justify-between px-4 py-3 gap-3 text-left hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold">{TYPE_LABELS[v.type as VignetteType]}</span>
                            <StatusBadge status={v.status as VignetteStatus} days={days} />
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarClock className="w-3 h-3" />
                            <span>{fmtDate(v.validFrom)} – {fmtDate(v.validUntil)}</span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-3 border-t border-border/60">
                          <div className="grid grid-cols-2 gap-2 pt-3">
                            <InfoCell label="SPZ" value={v.licensePlate} mono />
                            <InfoCell label="Platnost do" value={fmtDate(v.validUntil)} />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            {COUNTRY_PURCHASE_URLS[country] && (
                              <a
                                href={COUNTRY_PURCHASE_URLS[country]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-primary/30 bg-primary/10 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Koupit novou
                              </a>
                            )}
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDelete(v._id)}
                                disabled={deletingId === v._id}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/10 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                              >
                                {deletingId === v._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-secondary/30 px-3 py-2">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  )
}
