"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronLeft,
  Fuel,
  Gauge,
  Wrench,
  CreditCard,
  Receipt,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle,
  Calculator,
  X,
} from "lucide-react"

interface Props {
  vehicleId: Id<"vehicles">
  expenseId: Id<"expenses">
}

const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  fuel: { label: "Tankování", icon: Fuel, color: "text-fuel" },
  // Legacy types
  car_wash: { label: "Výdaje", icon: Receipt, color: "text-sky-400" },
  tires: { label: "Výdaje", icon: Receipt, color: "text-sky-400" },
  insurance: { label: "Výdaje", icon: Receipt, color: "text-sky-400" },
  other: { label: "Výdaje", icon: Receipt, color: "text-sky-400" },
  // New types
  expense: { label: "Výdaje", icon: Receipt, color: "text-sky-400" },
  service: { label: "Servis", icon: Wrench, color: "text-warning" },
  installment: { label: "Pořízení / splátka", icon: CreditCard, color: "text-orange-400" },
}

export function ExpenseDetailContent({ vehicleId, expenseId }: Props) {
  const router = useRouter()
  const expense = useQuery(api.expenses.getExpense, { expenseId })
  const receipt = useQuery(api.receipts.getReceiptByExpense, { expenseId })
  const myRole = useQuery(api.members.getMyRole, { vehicleId })

  const deleteExpense = useMutation(api.expenses.deleteExpense)
  const updateFuelExpense = useMutation(api.expenses.updateFuelExpense)

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)

  // Edit state for fuel
  const [editDate, setEditDate] = useState("")
  const [editLiters, setEditLiters] = useState("")
  const [editPpl, setEditPpl] = useState("")
  const [editOdometer, setEditOdometer] = useState("")
  const [editNote, setEditNote] = useState("")

  function startEditing() {
    if (!expense || expense.type !== "fuel") return
    setEditDate(new Date(expense.date).toISOString().split("T")[0])
    setEditLiters(String(expense.liters ?? "").replace(".", ","))
    setEditPpl(String(expense.pricePerLiter ?? "").replace(".", ","))
    setEditOdometer(String(expense.odometerKmTotal ?? ""))
    setEditNote(expense.note ?? "")
    setEditing(true)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await updateFuelExpense({
        expenseId,
        date: new Date(editDate).getTime(),
        liters: parseFloat(editLiters.replace(",", ".")),
        pricePerLiter: parseFloat(editPpl.replace(",", ".")),
        odometerKmTotal: parseInt(editOdometer.replace(/\s/g, ""), 10),
        note: editNote.trim() || undefined,
      })
      toast.success("Uloženo")
      setEditing(false)
    } catch (err: any) {
      toast.error(err.message ?? "Chyba při ukládání")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteExpense({ expenseId })
      toast.success("Výdaj smazán")
      router.replace(`/app/v/${vehicleId}/expenses`)
    } catch (err: any) {
      toast.error(err.message ?? "Chyba při mazání")
      setDeleting(false)
    }
  }

  if (expense === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!expense) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Výdaj nenalezen</p>
        <button onClick={() => router.back()} className="mt-4 text-primary text-sm">
          ← Zpět
        </button>
      </div>
    )
  }

  const typeInfo = typeLabels[expense.type] ?? typeLabels.other
  const TypeIcon = typeInfo.icon
  const canEdit = myRole === "owner" || true // Everyone can edit their own via mutation guard

  const totalAmount = editLiters && editPpl
    ? (parseFloat(editLiters.replace(",", ".")) * parseFloat(editPpl.replace(",", "."))).toFixed(2)
    : ""

  if (editing && expense.type === "fuel") {
    return (
      <div className="p-4 lg:p-6 max-w-lg mx-auto">
        <button
          onClick={() => setEditing(false)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          Zrušit úpravy
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-fuel-muted flex items-center justify-center">
            <Fuel className="w-5 h-5 text-fuel" />
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-exo2)" }}>
            Upravit tankování
          </h1>
        </div>

        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Datum</label>
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="form-input" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Množství (litry)</label>
            <div className="relative">
              <input type="number" value={editLiters} onChange={(e) => setEditLiters(e.target.value)} placeholder="45,23" step="0.01" className="form-input pr-10" required />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">l</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Cena za litr</label>
            <div className="relative">
              <input type="number" value={editPpl} onChange={(e) => setEditPpl(e.target.value)} placeholder="37,90" step="0.01" className="form-input pr-16" required />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Kč/l</span>
            </div>
          </div>

          {totalAmount && parseFloat(totalAmount) > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">
                Celkem: {parseFloat(totalAmount).toLocaleString("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Stav tachometru (km)</label>
            <div className="relative">
              <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="number" value={editOdometer} onChange={(e) => setEditOdometer(e.target.value)} placeholder="123456" step="1" className="form-input pl-10 pr-10" required />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">km</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Poznámka (volitelné)</label>
            <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Poznámka…" className="form-input" maxLength={200} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all hover:bg-primary/90 disabled:opacity-50 mt-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" />Uložit změny</>}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <ChevronLeft className="w-4 h-4" />
        Zpět
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 flex items-center justify-center ${
              expense.type === "fuel"
                ? "rounded-xl bg-fuel-muted"
                : expense.type === "service"
                ? "rounded-xl bg-warning/10 border border-warning/40"
                : "rounded-xl bg-secondary"
            }`}
          >
            <TypeIcon className={`w-6 h-6 ${typeInfo.color}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-exo2)" }}>
              {typeInfo.label}
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Date(expense.date).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-exo2)" }}>
            {expense.amountCzk.toLocaleString("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Warning */}
      {expense.needsReview && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-warning-muted border border-warning/30 mb-4">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-warning/90">Zkontrolujte data — spotřeba nebo vzdálenost vypadá neobvykle</p>
        </div>
      )}

      {/* Fuel details */}
      {expense.type === "fuel" && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {expense.liters !== undefined && (
            <StatCard label="Natankováno" value={`${expense.liters.toLocaleString("cs-CZ")} l`} />
          )}
          {expense.pricePerLiter !== undefined && (
            <StatCard label="Cena/litr" value={`${expense.pricePerLiter.toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} Kč`} />
          )}
          {expense.odometerKmTotal !== undefined && (
            <StatCard label="Tachometr" value={`${expense.odometerKmTotal.toLocaleString("cs-CZ")} km`} />
          )}
          {expense.distanceKm !== undefined && !expense.needsReview && (
            <StatCard label="Ujeto" value={`${expense.distanceKm.toLocaleString("cs-CZ")} km`} />
          )}
          {expense.consumptionLPer100 !== undefined && !expense.needsReview && (
            <StatCard
              label="Spotřeba"
              value={`${expense.consumptionLPer100.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} l/100km`}
              highlight
            />
          )}
        </div>
      )}

      {/* Note */}
      {expense.note && (
        <div className="p-3.5 rounded-xl bg-card border border-border mb-4">
          <p className="text-xs text-muted-foreground mb-1">Poznámka</p>
          <p className="text-sm">{expense.note}</p>
        </div>
      )}

      {/* Receipt */}
      {receipt !== undefined && (
        <div className="mb-4">
          {receipt ? (
            <div>
              <button
                onClick={() => setShowReceipt(!showReceipt)}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                {showReceipt ? "Skrýt účtenku" : "Zobrazit účtenku"}
              </button>
              {showReceipt && receipt.url && (
                <div className="mt-3 rounded-xl overflow-hidden border border-border">
                  <img src={receipt.url} alt="Účtenka" className="w-full max-h-96 object-contain bg-card" />
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Účtenka bude smazána {new Date(receipt.deleteAfter).toLocaleDateString("cs-CZ")}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Bez účtenky
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        {expense.type === "fuel" && canEdit && (
          <button
            onClick={startEditing}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-secondary/40 text-sm font-medium hover:bg-secondary/70 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Upravit
          </button>
        )}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 bg-destructive/10 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Smazat
        </button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5">
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "var(--font-exo2)" }}>
              Smazat výdaj?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Tuto akci nelze vrátit zpět.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary/40 transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Smazat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3.5 rounded-xl border ${highlight ? "bg-fuel-muted border-fuel/20" : "bg-card border-border"}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-base font-semibold ${highlight ? "text-fuel" : ""}`}>{value}</p>
    </div>
  )
}
