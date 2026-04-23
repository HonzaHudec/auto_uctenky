"use client"

import { useState, useRef } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Fuel,
  Camera,
  Loader2,
  CheckCircle,
  ChevronLeft,
  Gauge,
  Calculator,
  Wrench,
  CreditCard,
  Receipt,
} from "lucide-react"

interface Props {
  vehicleId: Id<"vehicles">
}

type ExpenseType = "fuel" | "service" | "expense" | "installment"
type FuelSubtype = "benzin" | "nafta" | "elektrina"

const FUEL_SUBTYPE_LABELS: Record<FuelSubtype, string> = {
  benzin: "Benzín",
  nafta: "Nafta",
  elektrina: "Elektřina",
}

const expenseTypes: { value: ExpenseType; label: string; sublabel: string; icon: React.ElementType; cardCls: string; iconBg: string; iconCls: string; labelCls: string }[] = [
  {
    value: "fuel", label: "Tankování", sublabel: "PHM, LPG, elektřina", icon: Fuel,
    cardCls: "bg-fuel-muted border-fuel/40 hover:border-fuel/70",
    iconBg: "bg-fuel/20", iconCls: "text-fuel", labelCls: "text-fuel",
  },
  {
    value: "service", label: "Servis", sublabel: "údržba, opravy, STK", icon: Wrench,
    cardCls: "bg-warning/10 border-warning/30 hover:border-warning/60",
    iconBg: "bg-warning/20", iconCls: "text-warning", labelCls: "text-warning",
  },
  {
    value: "expense", label: "Výdaje", sublabel: "mytí, pneumatiky, parkoviště…", icon: Receipt,
    cardCls: "bg-sky-500/10 border-sky-500/30 hover:border-sky-500/60",
    iconBg: "bg-sky-500/20", iconCls: "text-sky-400", labelCls: "text-sky-400",
  },
  {
    value: "installment", label: "Pořízení / splátka", sublabel: "leasing, úvěr, pojištění", icon: CreditCard,
    cardCls: "bg-orange-500/10 border-orange-500/30 hover:border-orange-500/60",
    iconBg: "bg-orange-500/20", iconCls: "text-orange-400", labelCls: "text-orange-400",
  },
]

export function NewExpenseContent({ vehicleId }: Props) {
  const [expenseType, setExpenseType] = useState<ExpenseType>("fuel")
  const [step, setStep] = useState<"type" | "receipt" | "form">("type")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fuel subtype selection
  const [fuelSubtype, setFuelSubtype] = useState<FuelSubtype | "">("")

  // Form fields
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [liters, setLiters] = useState("")
  const [pricePerLiter, setPricePerLiter] = useState("")
  const [odometer, setOdometer] = useState("")
  const [note, setNote] = useState("")
  const [amountCzk, setAmountCzk] = useState("")

  // Vehicle data for fuel type config
  const vehicle = useQuery(api.vehicles.getVehicle, { vehicleId })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Resolve the effective fuel subtype for the current entry
  const supportedFuels = vehicle?.supportedFuelTypes ?? []
  const vehicleDefaultFuel = vehicle?.defaultFuelType
  const activeFuelSubtype: FuelSubtype | undefined =
    fuelSubtype
      ? (fuelSubtype as FuelSubtype)
      : vehicleDefaultFuel ?? (supportedFuels[0] as FuelSubtype | undefined)

  const isElectric = activeFuelSubtype === "elektrina"
  const quantityLabel = isElectric ? "Množství (kWh)" : "Množství (litry)"
  const quantityUnit = isElectric ? "kWh" : "l"
  const priceUnitLabel = isElectric ? "Kč/kWh" : "Kč/l"
  const priceFieldLabel = isElectric ? "Cena za kWh" : "Cena za litr"

  const createFuelExpense = useMutation(api.expenses.createFuelExpense)
  const createOtherExpense = useMutation(api.expenses.createOtherExpense)
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl)
  const createReceipt = useMutation(api.receipts.createReceipt)

  const totalAmount =
    liters && pricePerLiter
      ? (parseFloat(liters.replace(",", ".")) * parseFloat(pricePerLiter.replace(",", "."))).toFixed(2)
      : ""

  function toInputNumberString(value: number): string {
    return Number.isInteger(value) ? String(value) : String(value.toFixed(3)).replace(/\.?0+$/, "")
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    console.log("Image selected:", file.name, file.size)
  }

  async function handleOCR() {
    if (!imageFile) return
    setOcrLoading(true)
    console.log("Starting OCR for file:", imageFile.name)

    try {
      const { base64, mimeType: compressedMime } = await compressImage(imageFile)
      console.log("OCR image compressed, base64 length:", base64.length)

      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: compressedMime }),
      })

      if (!response.ok) throw new Error("OCR request failed")

      const data = await response.json()
      console.log("OCR result:", data)

      const hasValidDate = typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
      if (hasValidDate) {
        setDate(data.date)
      }
      const totalFromReceipt =
        typeof data.totalAmountCzk === "number" && Number.isFinite(data.totalAmountCzk) ? data.totalAmountCzk : null
      const litersFromReceipt = typeof data.liters === "number" && Number.isFinite(data.liters) ? data.liters : null
      const pricePerLiterFromReceipt =
        typeof data.pricePerLiter === "number" && Number.isFinite(data.pricePerLiter) ? data.pricePerLiter : null

      if (litersFromReceipt !== null) {
        setLiters(toInputNumberString(litersFromReceipt))
      }
      if (pricePerLiterFromReceipt !== null) {
        setPricePerLiter(toInputNumberString(pricePerLiterFromReceipt))
      }
      if (totalFromReceipt !== null) {
        toast.info(`Celkem na účtence: ${totalFromReceipt.toLocaleString("cs-CZ")} Kč`)
      }
      if (!hasValidDate) {
        toast.info("Datum z účtenky nebylo rozpoznáno, zkontrolujte ho ručně")
      }

      if (data.confidence === "high") {
        toast.success("Účtenka rozpoznána!")
      } else if (data.confidence === "medium") {
        toast.success("Zkontrolujte rozpoznané hodnoty")
      } else {
        toast.info("Účtenka nebyla rozpoznána, zadejte ručně")
      }
    } catch (err) {
      console.error("OCR error:", err)
      toast.error("OCR selhalo — zadejte hodnoty ručně")
    } finally {
      setOcrLoading(false)
      setStep("form")
    }
  }

  function skipOCR() {
    setStep("form")
  }

  async function uploadReceipt(): Promise<Id<"_storage"> | null> {
    if (!imageFile) return null
    try {
      const uploadUrl = await generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": imageFile.type },
        body: imageFile,
      })
      if (!res.ok) throw new Error("Upload failed")
      const { storageId } = await res.json()
      console.log("Receipt uploaded, storageId:", storageId)
      return storageId
    } catch (err) {
      console.error("Receipt upload error:", err)
      return null
    }
  }

  async function handleSaveFuel(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    const litersNum = parseFloat(liters.replace(",", "."))
    const pplNum = parseFloat(pricePerLiter.replace(",", "."))
    const odometerNum = parseInt(odometer.replace(/\s/g, ""), 10)

    if (!litersNum || !pplNum || !odometerNum) {
      toast.error("Vyplňte všechna povinná pole")
      return
    }

    setSaving(true)
    try {
      const expenseId = await createFuelExpense({
        vehicleId,
        date: new Date(date).getTime(),
        fuelSubtype: activeFuelSubtype || undefined,
        liters: litersNum,
        pricePerLiter: pplNum,
        odometerKmTotal: odometerNum,
        note: note.trim() || undefined,
      })

      // Upload receipt in background
      if (imageFile) {
        const storageId = await uploadReceipt()
        if (storageId) {
          try {
            await createReceipt({ vehicleId, storageId, expenseId })
          } catch (err) {
            console.error("Receipt link error:", err)
          }
        }
      }

      toast.success("Tankování uloženo!")
      router.replace(`/app/v/${vehicleId}/dashboard`)
    } catch (err: any) {
      console.error("Save fuel error:", err)
      toast.error(err.message ?? "Nepodařilo se uložit")
      setSaving(false)
    }
  }

  async function handleSaveOther(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    const amount = parseFloat(amountCzk.replace(",", ".").replace(/\s/g, ""))
    if (!amount) {
      toast.error("Zadejte částku")
      return
    }

    setSaving(true)
    try {
      await createOtherExpense({
        vehicleId,
        type: expenseType as "service" | "expense" | "installment",
        date: new Date(date).getTime(),
        amountCzk: amount,
        note: note.trim() || undefined,
      })

      toast.success("Výdaj uložen!")
      router.replace(`/app/v/${vehicleId}/expenses`)
    } catch (err: any) {
      console.error("Save other expense error:", err)
      toast.error(err.message ?? "Nepodařilo se uložit")
      setSaving(false)
    }
  }

  // --- STEP: TYPE SELECTION ---
  if (step === "type") {
    return (
      <div className="p-4 lg:p-6 max-w-lg mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          Zpět
        </button>

        <h1
          className="text-2xl font-bold mb-6"
          style={{ fontFamily: "var(--font-exo2)" }}
        >
          Nový výdaj
        </h1>

        <div className="grid grid-cols-1 gap-3">
          {expenseTypes.map(({ value, label, sublabel, icon: Icon, cardCls, iconBg, iconCls, labelCls }) => (
            <button
              key={value}
              onClick={() => {
                setExpenseType(value)
                if (value === "fuel") {
                  setStep("receipt")
                } else {
                  setStep("form")
                }
              }}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${cardCls}`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
              >
                {value === "service" ? (
                  <span className="inline-flex items-center justify-center p-0.5 rounded-[6px] border border-warning/40">
                    <Icon className={`w-4 h-4 ${iconCls}`} />
                  </span>
                ) : (
                  <Icon className={`w-5 h-5 ${iconCls}`} />
                )}
              </div>
              <div>
                <p className={`font-semibold text-sm ${labelCls}`}>{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // --- STEP: RECEIPT UPLOAD (fuel only) ---
  if (step === "receipt" && expenseType === "fuel") {
    return (
      <div className="p-4 lg:p-6 max-w-lg mx-auto">
        <button
          onClick={() => setStep("type")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          Zpět
        </button>

        <h1
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: "var(--font-exo2)" }}
        >
          Tankování
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          Vyfocením účtenky vyplníme hodnoty automaticky
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {imagePreview ? (
          <div className="mb-5">
            <div className="relative rounded-xl overflow-hidden border border-border mb-3">
              <img
                src={imagePreview}
                alt="Účtenka"
                className="w-full max-h-64 object-cover"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-secondary/40 text-sm font-medium hover:bg-secondary/70 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Jiná fotka
              </button>
              <button
                onClick={handleOCR}
                disabled={ocrLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70"
              >
                {ocrLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Zpracovávám…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Rozpoznat
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/50 bg-card hover:bg-secondary/30 transition-all p-12 flex flex-col items-center gap-3 mb-5"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Camera className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">Vyfotit nebo vybrat účtenku</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG nebo HEIC</p>
            </div>
          </button>
        )}

        <button
          onClick={skipOCR}
          className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border rounded-xl"
        >
          Přeskočit, zadat ručně →
        </button>
      </div>
    )
  }

  // --- STEP: FORM (fuel) ---
  if (expenseType === "fuel") {
    return (
      <div className="p-4 lg:p-6 max-w-lg mx-auto">
        <button
          onClick={() => setStep("receipt")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          Zpět
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-fuel-muted flex items-center justify-center">
            <Fuel className="w-5 h-5 text-fuel" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-exo2)" }}
            >
              Tankování
            </h1>
            {imagePreview && (
              <p className="text-xs text-primary">✓ Účtenka přiložena</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveFuel} className="space-y-4">
          {/* Date */}
          <FormField label="Datum">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input"
              required
            />
          </FormField>

          {/* Fuel subtype selector — shown when vehicle has 2+ supported fuels */}
          {supportedFuels.length >= 2 && (
            <FormField label="Druh paliva">
              <div className="flex gap-2 flex-wrap">
                {supportedFuels.map((ft) => (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => setFuelSubtype(ft as FuelSubtype)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      activeFuelSubtype === ft
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-input border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {FUEL_SUBTYPE_LABELS[ft as FuelSubtype]}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          {/* Quantity */}
          <FormField label={quantityLabel} hint={isElectric ? "Kolik kWh bylo nabito" : "Kolik litrů bylo natankováno"}>
            <div className="relative">
              <input
                type="number"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                placeholder={isElectric ? "45,0" : "45,23"}
                step="0.01"
                min="0.1"
                max={isElectric ? "200" : "300"}
                className="form-input pr-14"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{quantityUnit}</span>
            </div>
          </FormField>

          {/* Price per unit */}
          <FormField label={priceFieldLabel} hint="V korunách">
            <div className="relative">
              <input
                type="number"
                value={pricePerLiter}
                onChange={(e) => setPricePerLiter(e.target.value)}
                placeholder={isElectric ? "6,50" : "37,90"}
                step="0.01"
                min="0.01"
                max={isElectric ? "30" : "200"}
                className="form-input pr-20"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{priceUnitLabel}</span>
            </div>
          </FormField>

          {/* Total preview */}
          {totalAmount && parseFloat(totalAmount) > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">
                Celkem: {parseFloat(totalAmount).toLocaleString("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Odometer */}
          <FormField label="Stav tachometru (km)" hint="Celkový nájezd při tankování">
            <div className="relative">
              <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="123456"
                step="1"
                min="0"
                className="form-input pl-10 pr-10"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">km</span>
            </div>
          </FormField>

          {/* Note */}
          <FormField label="Poznámka (volitelné)">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Shell D1, dálnice…"
              className="form-input"
              maxLength={200}
            />
          </FormField>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Uložit tankování
              </>
            )}
          </button>
        </form>
      </div>
    )
  }

  // --- STEP: FORM (other expense) ---
  const currentTypeInfo = expenseTypes.find((t) => t.value === expenseType)!

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto">
      <button
        onClick={() => setStep("type")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <ChevronLeft className="w-4 h-4" />
        Zpět
      </button>

      <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            {expenseType === "service" ? (
              <span className="inline-flex items-center justify-center p-0.5 rounded-[6px] border border-warning/40">
                <currentTypeInfo.icon className="w-4 h-4 text-warning" />
              </span>
            ) : (
              <currentTypeInfo.icon className="w-5 h-5 text-muted-foreground" />
            )}
        </div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-exo2)" }}
        >
          {currentTypeInfo.label}
        </h1>
      </div>

      <form onSubmit={handleSaveOther} className="space-y-4">
        <FormField label="Datum">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="form-input"
            required
          />
        </FormField>

        <FormField label="Částka (Kč)">
          <div className="relative">
            <input
              type="number"
              value={amountCzk}
              onChange={(e) => setAmountCzk(e.target.value)}
              placeholder="1 500"
              step="0.01"
              min="1"
              className="form-input pr-10"
              required
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Kč</span>
          </div>
        </FormField>

        <FormField label="Poznámka (volitelné)">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Popis výdaje…"
            className="form-input"
            maxLength={200}
          />
        </FormField>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 mt-2"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Uložit výdaj
            </>
          )}
        </button>
      </form>
    </div>
  )
}

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

function FormField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground/80">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
