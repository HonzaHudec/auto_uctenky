"use client"

import { useState, useRef } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import {
  FileText,
  Pencil,
  X,
  Check,
  Loader2,
  Camera,
  Sparkles,
  ScanLine,
  AlertTriangle,
} from "lucide-react"

type FuelType = "benzin" | "diesel" | "hybrid" | "elektro" | "lpg" | "other"
type FuelSubtype = "benzin" | "nafta" | "elektrina"

interface VehicleData {
  _id: Id<"vehicles">
  spz?: string
  brand?: string
  model?: string
  yearManufactured?: number
  vin?: string
  color?: string
  fuelType?: FuelType
  supportedFuelTypes?: FuelSubtype[]
  defaultFuelType?: FuelSubtype
  engineCcm?: number
  powerKw?: number
  tankCapacityL?: number
  batteryCapacityKwh?: number
  firstRegistrationDate?: number
}

const FUEL_SUBTYPE_LABELS: Record<FuelSubtype, string> = {
  benzin: "Benzín",
  nafta: "Nafta",
  elektrina: "Elektřina",
}

const ALL_FUEL_SUBTYPES: FuelSubtype[] = ["benzin", "nafta", "elektrina"]

interface Props {
  vehicle: VehicleData
  isOwner: boolean
}

const FUEL_LABELS: Record<FuelType, string> = {
  benzin: "Benzín",
  diesel: "Diesel / Nafta",
  hybrid: "Hybrid",
  elektro: "Elektro",
  lpg: "LPG",
  other: "Jiné",
}

function tsToDateInput(ts: number | undefined): string {
  if (!ts) return ""
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function dateInputToTs(s: string): number | undefined {
  if (!s) return undefined
  const d = new Date(s)
  if (isNaN(d.getTime())) return undefined
  return d.getTime()
}

export function VehicleDetailsSection({ vehicle, isOwner }: Props) {
  const updateDetails = useMutation(api.vehicles.updateVehicleDetails)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scannedOnce, setScannedOnce] = useState(false)
  const [missingAfterOcr, setMissingAfterOcr] = useState<Set<string>>(new Set())
  const [page1, setPage1] = useState<File | null>(null)
  const [page2, setPage2] = useState<File | null>(null)
  const [page1Preview, setPage1Preview] = useState<string | null>(null)
  const [page2Preview, setPage2Preview] = useState<string | null>(null)
  const fileInput1Ref = useRef<HTMLInputElement>(null)
  const fileInput2Ref = useRef<HTMLInputElement>(null)

  // Form state
  const [form, setForm] = useState({
    spz: vehicle.spz ?? "",
    brand: vehicle.brand ?? "",
    model: vehicle.model ?? "",
    yearManufactured: vehicle.yearManufactured?.toString() ?? "",
    vin: vehicle.vin ?? "",
    color: vehicle.color ?? "",
    fuelType: (vehicle.fuelType ?? "") as FuelType | "",
    supportedFuelTypes: vehicle.supportedFuelTypes ?? ([] as FuelSubtype[]),
    defaultFuelType: (vehicle.defaultFuelType ?? "") as FuelSubtype | "",
    engineCcm: vehicle.engineCcm?.toString() ?? "",
    powerKw: vehicle.powerKw?.toString() ?? "",
    tankCapacityL: vehicle.tankCapacityL?.toString() ?? "",
    batteryCapacityKwh: vehicle.batteryCapacityKwh?.toString() ?? "",
    firstRegistrationDate: tsToDateInput(vehicle.firstRegistrationDate),
  })

  function startEditing() {
    setForm({
      spz: vehicle.spz ?? "",
      brand: vehicle.brand ?? "",
      model: vehicle.model ?? "",
      yearManufactured: vehicle.yearManufactured?.toString() ?? "",
      vin: vehicle.vin ?? "",
      color: vehicle.color ?? "",
      fuelType: (vehicle.fuelType ?? "") as FuelType | "",
      supportedFuelTypes: vehicle.supportedFuelTypes ?? ([] as FuelSubtype[]),
      defaultFuelType: (vehicle.defaultFuelType ?? "") as FuelSubtype | "",
      engineCcm: vehicle.engineCcm?.toString() ?? "",
      powerKw: vehicle.powerKw?.toString() ?? "",
      tankCapacityL: vehicle.tankCapacityL?.toString() ?? "",
      batteryCapacityKwh: vehicle.batteryCapacityKwh?.toString() ?? "",
      firstRegistrationDate: tsToDateInput(vehicle.firstRegistrationDate),
    })
    setPage1(null)
    setPage2(null)
    setPage1Preview(null)
    setPage2Preview(null)
    setScannedOnce(false)
    setMissingAfterOcr(new Set())
    setEditing(true)
  }

  function handlePageSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    page: 1 | 2,
  ) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const url = URL.createObjectURL(file)
    if (page === 1) {
      setPage1(file)
      setPage1Preview(url)
    } else {
      setPage2(file)
      setPage2Preview(url)
    }
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      await updateDetails({
        vehicleId: vehicle._id,
        spz: form.spz.trim() || undefined,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        yearManufactured: form.yearManufactured ? Number(form.yearManufactured) : undefined,
        vin: form.vin.trim() || undefined,
        color: form.color.trim() || undefined,
        fuelType: (form.fuelType as FuelType) || undefined,
        supportedFuelTypes: form.supportedFuelTypes.length > 0 ? form.supportedFuelTypes : undefined,
        defaultFuelType: (form.defaultFuelType as FuelSubtype) || undefined,
        engineCcm: form.engineCcm ? Number(form.engineCcm) : undefined,
        powerKw: form.powerKw ? Number(form.powerKw) : undefined,
        tankCapacityL: form.tankCapacityL ? Number(form.tankCapacityL) : undefined,
        batteryCapacityKwh: form.batteryCapacityKwh ? Number(form.batteryCapacityKwh) : undefined,
        firstRegistrationDate: dateInputToTs(form.firstRegistrationDate),
      })
      toast.success("Údaje uloženy")
      setEditing(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleAnalyze() {
    if (!page1 && !page2) return
    setScanning(true)
    const pageCount = [page1, page2].filter(Boolean).length
    toast.info(`Analyzuji ${pageCount === 2 ? "obě strany" : "stranu"} TP…`)

    try {
      const pages = [page1, page2].filter(Boolean) as File[]
      const images = await Promise.all(
        pages.map(async (f) => {
          const { base64, mimeType } = await compressImage(f)
          console.log("Compressed page, mimeType:", mimeType, "base64 length:", base64.length)
          return { imageBase64: base64, mimeType }
        }),
      )

      const res = await fetch("/api/ocr-tp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      })
      const data = await res.json()
      console.log("TP OCR result:", data)

      if (data.confidence === "low") {
        toast.warning("Nepodařilo se přečíst průkaz – zkuste ostřejší foto")
        return
      }

      setForm((prev) => ({
        ...prev,
        spz: data.spz ?? prev.spz,
        brand: data.brand ?? prev.brand,
        model: data.model ?? prev.model,
        yearManufactured: data.yearManufactured?.toString() ?? prev.yearManufactured,
        vin: data.vin ?? prev.vin,
        color: data.color ?? prev.color,
        fuelType: (data.fuelType as FuelType) ?? prev.fuelType,
        engineCcm: data.engineCcm?.toString() ?? prev.engineCcm,
        powerKw: data.powerKw?.toString() ?? prev.powerKw,
        firstRegistrationDate: data.firstRegistrationDate ?? prev.firstRegistrationDate,
      }))

      // Track which TP fields were not found — user must fill them in manually
      const tpFields: Array<{ key: string; label: string }> = [
        { key: "spz", label: "SPZ" },
        { key: "brand", label: "Značka" },
        { key: "model", label: "Model" },
        { key: "yearManufactured", label: "Rok výroby" },
        { key: "vin", label: "VIN" },
        { key: "color", label: "Barva" },
        { key: "fuelType", label: "Palivo" },
        { key: "engineCcm", label: "Motor (cm³)" },
        { key: "powerKw", label: "Výkon (kW)" },
        { key: "firstRegistrationDate", label: "1. registrace" },
        { key: "tankCapacityL", label: "Kapacita nádrže" },
      ]
      const missing = new Set<string>()
      for (const f of tpFields) {
        const ocr = data[f.key as keyof typeof data]
        if (!ocr) missing.add(f.key)
      }
      setMissingAfterOcr(missing)
      setScannedOnce(true)

      const foundCount = tpFields.length - missing.size
      const confidence = data.confidence === "high" ? "Skvěle" : "Částečně"
      toast.success(`${confidence} přečteno (${foundCount}/${tpFields.length} polí) — doplňte zbývající`)
    } catch (err) {
      console.error("TP scan error:", err)
      toast.error("Chyba při analýze průkazu")
    } finally {
      setScanning(false)
    }
  }

  const hasData =
    vehicle.spz ||
    vehicle.brand ||
    vehicle.model ||
    vehicle.yearManufactured ||
    vehicle.vin ||
    vehicle.color ||
    vehicle.fuelType ||
    vehicle.engineCcm ||
    vehicle.powerKw ||
    vehicle.firstRegistrationDate

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="w-4 h-4" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Technické údaje</h2>
        </div>
        {isOwner && !editing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Upravit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          {hasData ? (
            <div className="divide-y divide-border">
              {vehicle.spz && (
                <DetailRow label="SPZ" value={vehicle.spz} highlight />
              )}
              {(vehicle.brand || vehicle.model) && (
                <DetailRow
                  label="Vozidlo"
                  value={[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}
                />
              )}
              {vehicle.yearManufactured && (
                <DetailRow label="Rok výroby" value={String(vehicle.yearManufactured)} />
              )}
              {vehicle.fuelType && (
                <DetailRow label="Palivo (TP)" value={FUEL_LABELS[vehicle.fuelType]} />
              )}
              {vehicle.supportedFuelTypes && vehicle.supportedFuelTypes.length > 0 && (
                <DetailRow
                  label="Tankování"
                  value={vehicle.supportedFuelTypes.map((f) => FUEL_SUBTYPE_LABELS[f]).join(", ")}
                />
              )}
              {vehicle.defaultFuelType && (
                <DetailRow label="Výchozí palivo" value={FUEL_SUBTYPE_LABELS[vehicle.defaultFuelType]} />
              )}
              {vehicle.color && (
                <DetailRow label="Barva" value={vehicle.color} />
              )}
              {vehicle.engineCcm && (
                <DetailRow label="Motor" value={`${vehicle.engineCcm} cm³`} />
              )}
              {vehicle.powerKw && (
                <DetailRow label="Výkon" value={`${vehicle.powerKw} kW`} />
              )}
              {vehicle.tankCapacityL && vehicle.fuelType !== "elektro" && (
                <DetailRow label="Nádrž" value={`${vehicle.tankCapacityL} l`} />
              )}
              {vehicle.batteryCapacityKwh && (vehicle.fuelType === "hybrid" || vehicle.fuelType === "elektro") && (
                <DetailRow label="Baterie" value={`${vehicle.batteryCapacityKwh} kWh`} />
              )}
              {vehicle.vin && (
                <DetailRow label="VIN" value={vehicle.vin} mono />
              )}
              {vehicle.firstRegistrationDate && (
                <DetailRow
                  label="1. registrace"
                  value={new Date(vehicle.firstRegistrationDate).toLocaleDateString("cs-CZ")}
                />
              )}
            </div>
          ) : (
            <div className="p-5 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Zatím žádné technické údaje
              </p>
              {isOwner && (
                <button
                  onClick={startEditing}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Přidat údaje →
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border p-4 space-y-4">
          {/* OCR — 2-page scan */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Vyfoťte obě strany TP — AI vyplní pole automaticky</span>
            </div>

            <input
              ref={fileInput1Ref}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePageSelect(e, 1)}
            />
            <input
              ref={fileInput2Ref}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePageSelect(e, 2)}
            />

            <div className="grid grid-cols-2 gap-2">
              {/* Page 1 button */}
              <button
                type="button"
                onClick={() => fileInput1Ref.current?.click()}
                disabled={scanning}
                className="relative flex flex-col items-center justify-center gap-1 h-20 rounded-xl border-2 border-dashed transition-colors disabled:opacity-50 overflow-hidden"
                style={{
                  borderColor: page1 ? "var(--primary)" : "color-mix(in srgb, var(--primary) 30%, transparent)",
                  background: page1 ? "transparent" : "color-mix(in srgb, var(--primary) 5%, transparent)",
                }}
              >
                {page1Preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page1Preview}
                    alt="Strana 1"
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                  />
                ) : null}
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <Camera className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary">
                    {page1 ? "✓ Strana 1" : "Strana 1"}
                  </span>
                </div>
              </button>

              {/* Page 2 button */}
              <button
                type="button"
                onClick={() => fileInput2Ref.current?.click()}
                disabled={scanning}
                className="relative flex flex-col items-center justify-center gap-1 h-20 rounded-xl border-2 border-dashed transition-colors disabled:opacity-50 overflow-hidden"
                style={{
                  borderColor: page2 ? "var(--primary)" : "color-mix(in srgb, var(--primary) 30%, transparent)",
                  background: page2 ? "transparent" : "color-mix(in srgb, var(--primary) 5%, transparent)",
                }}
              >
                {page2Preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page2Preview}
                    alt="Strana 2"
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                  />
                ) : null}
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <Camera className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary">
                    {page2 ? "✓ Strana 2" : "Strana 2"}
                  </span>
                </div>
              </button>
            </div>

            {/* Analyze button — shown once at least one page selected */}
            {(page1 || page2) && (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={scanning}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzuji…
                  </>
                ) : (
                  <>
                    <ScanLine className="w-4 h-4" />
                    Analyzovat {page1 && page2 ? "obě strany" : "stranu"}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Missing fields banner — shown after OCR if some fields not found */}
          {scannedOnce && missingAfterOcr.size > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-warning">Tyto údaje nebyly nalezeny v TP</p>
                <p className="text-xs text-muted-foreground mt-0.5">Doplňte je ručně — jsou zvýrazněny oranžově níže.</p>
              </div>
            </div>
          )}

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="SPZ"
              value={form.spz}
              onChange={(v) => setForm((p) => ({ ...p, spz: v }))}
              placeholder="1AB 2345"
              className="col-span-2"
              missing={scannedOnce && missingAfterOcr.has("spz") && !form.spz}
            />
            <FormField
              label="Značka"
              value={form.brand}
              onChange={(v) => setForm((p) => ({ ...p, brand: v }))}
              placeholder="Škoda"
              missing={scannedOnce && missingAfterOcr.has("brand") && !form.brand}
            />
            <FormField
              label="Model"
              value={form.model}
              onChange={(v) => setForm((p) => ({ ...p, model: v }))}
              placeholder="Octavia"
              missing={scannedOnce && missingAfterOcr.has("model") && !form.model}
            />
            <FormField
              label="Rok výroby"
              value={form.yearManufactured}
              onChange={(v) => setForm((p) => ({ ...p, yearManufactured: v }))}
              placeholder="2020"
              type="number"
              missing={scannedOnce && missingAfterOcr.has("yearManufactured") && !form.yearManufactured}
            />
            <div>
              <label className={`block text-xs mb-1.5 ${scannedOnce && missingAfterOcr.has("fuelType") && !form.fuelType ? "text-warning font-semibold" : "text-muted-foreground"}`}>
                Palivo{scannedOnce && missingAfterOcr.has("fuelType") && !form.fuelType ? " *" : ""}
              </label>
              <select
                value={form.fuelType}
                onChange={(e) => setForm((p) => ({ ...p, fuelType: e.target.value as FuelType | "" }))}
                className={`w-full rounded-lg bg-input border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${scannedOnce && missingAfterOcr.has("fuelType") && !form.fuelType ? "border-warning/60 focus:ring-warning/50" : "border-border focus:ring-primary/50"}`}
              >
                <option value="">Vyberte…</option>
                {Object.entries(FUEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <FormField
              label="Barva"
              value={form.color}
              onChange={(v) => setForm((p) => ({ ...p, color: v }))}
              placeholder="Černá"
              missing={scannedOnce && missingAfterOcr.has("color") && !form.color}
            />
            <FormField
              label="Motor (cm³)"
              value={form.engineCcm}
              onChange={(v) => setForm((p) => ({ ...p, engineCcm: v }))}
              placeholder="1598"
              type="number"
              missing={scannedOnce && missingAfterOcr.has("engineCcm") && !form.engineCcm}
            />
            <FormField
              label="Výkon (kW)"
              value={form.powerKw}
              onChange={(v) => setForm((p) => ({ ...p, powerKw: v }))}
              placeholder="85"
              type="number"
              missing={scannedOnce && missingAfterOcr.has("powerKw") && !form.powerKw}
            />
            {/* Nádrž — hidden for pure elektro */}
            {form.fuelType !== "elektro" && (
              <FormField
                label="Nádrž (l)"
                value={form.tankCapacityL}
                onChange={(v) => setForm((p) => ({ ...p, tankCapacityL: v }))}
                placeholder="50"
                type="number"
                missing={scannedOnce && missingAfterOcr.has("tankCapacityL") && !form.tankCapacityL}
              />
            )}
            {/* Baterie — shown for hybrid and elektro */}
            {(form.fuelType === "hybrid" || form.fuelType === "elektro") && (
              <FormField
                label="Baterie (kWh)"
                value={form.batteryCapacityKwh}
                onChange={(v) => setForm((p) => ({ ...p, batteryCapacityKwh: v }))}
                placeholder="77"
                type="number"
              />
            )}
            <div>
              <label className={`block text-xs mb-1.5 ${scannedOnce && missingAfterOcr.has("firstRegistrationDate") && !form.firstRegistrationDate ? "text-warning font-semibold" : "text-muted-foreground"}`}>
                1. registrace{scannedOnce && missingAfterOcr.has("firstRegistrationDate") && !form.firstRegistrationDate ? " *" : ""}
              </label>
              <input
                type="date"
                value={form.firstRegistrationDate}
                onChange={(e) => setForm((p) => ({ ...p, firstRegistrationDate: e.target.value }))}
                className={`w-full rounded-lg bg-input border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${scannedOnce && missingAfterOcr.has("firstRegistrationDate") && !form.firstRegistrationDate ? "border-warning/60 focus:ring-warning/50" : "border-border focus:ring-primary/50"}`}
              />
            </div>
            <FormField
              label="VIN"
              value={form.vin}
              onChange={(v) => setForm((p) => ({ ...p, vin: v }))}
              placeholder="WVW ZZZ..."
              className="col-span-2"
              mono
              missing={scannedOnce && missingAfterOcr.has("vin") && !form.vin}
            />

            {/* Supported fuel types */}
            <div className="col-span-2 space-y-2 pt-1">
              <label className="block text-xs text-muted-foreground">Paliva pro tankování</label>
              <div className="flex gap-2 flex-wrap">
                {ALL_FUEL_SUBTYPES.map((ft) => {
                  const selected = form.supportedFuelTypes.includes(ft)
                  return (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => {
                        setForm((p) => {
                          const next = selected
                            ? p.supportedFuelTypes.filter((x) => x !== ft)
                            : [...p.supportedFuelTypes, ft]
                          // If currently defaulted to a deselected type, update it
                          const defaultFuel: FuelSubtype | "" = next.includes(p.defaultFuelType as FuelSubtype)
                            ? (p.defaultFuelType as FuelSubtype | "")
                            : (next[0] ?? "")
                          return { ...p, supportedFuelTypes: next, defaultFuelType: defaultFuel }
                        })
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-input border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {FUEL_SUBTYPE_LABELS[ft]}
                    </button>
                  )
                })}
              </div>
              {form.supportedFuelTypes.length >= 2 && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Výchozí palivo</label>
                  <select
                    value={form.defaultFuelType}
                    onChange={(e) => setForm((p) => ({ ...p, defaultFuelType: e.target.value as FuelSubtype | "" }))}
                    className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Vyberte výchozí…</option>
                    {form.supportedFuelTypes.map((ft) => (
                      <option key={ft} value={ft}>{FUEL_SUBTYPE_LABELS[ft]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary/40 transition-colors"
            >
              <X className="w-4 h-4" />
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
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
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  highlight,
  mono,
}: {
  label: string
  value: string
  highlight?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-sm text-right break-all ${
          highlight ? "font-bold text-primary" : mono ? "font-mono text-xs" : "font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className,
  mono,
  missing,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
  mono?: boolean
  missing?: boolean
}) {
  return (
    <div className={className}>
      <label className={`block text-xs mb-1.5 ${missing ? "text-warning font-semibold" : "text-muted-foreground"}`}>
        {label}{missing ? " *" : ""}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg bg-input border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          missing
            ? "border-warning/60 ring-warning/30 focus:ring-warning/50"
            : "border-border focus:ring-primary/50"
        } ${mono ? "font-mono" : ""}`}
      />
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(",")[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Resize + compress image before OCR — phone photos can be 5–10 MB which
// exceeds the API body limit. 1500 px / JPEG 80 % is plenty for text reading.
function compressImage(file: File, maxPx = 1500, quality = 0.8): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) { reject(new Error("No canvas context")); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return }
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve({ base64: result.split(",")[1], mimeType: "image/jpeg" })
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        },
        "image/jpeg",
        quality,
      )
    }
    img.onerror = reject
    img.src = url
  })
}
