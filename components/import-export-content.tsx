"use client"

import { useState, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import Link from "next/link"
import { format } from "date-fns"
import { cs } from "date-fns/locale"
import {
  Download,
  Upload,
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Table2,
} from "lucide-react"

interface Props {
  vehicleId: Id<"vehicles">
}

const TYPE_LABELS: Record<string, string> = {
  fuel: "Tankování",
  service: "Servis",
  expense: "Výdaj",
  installment: "Pořízení / splátka",
  tires: "Pneumatiky",
  insurance: "Pojistka",
  car_wash: "Mytí",
  other: "Ostatní",
}

const CSV_TEMPLATE = `datum,typ,castka_czk,litry,cena_za_litr,tachometr_km,poznamka
2026-01-15,fuel,1250,42.5,29.4,85000,Shell benzinka
2026-01-20,service,3500,,,,Výměna oleje
2026-02-01,installment,5000,,,,Splátka leasingu`

function parseDate(str: string): number | null {
  // Accepts YYYY-MM-DD or DD.MM.YYYY
  str = str.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str)
    return isNaN(d.getTime()) ? null : d.getTime()
  }
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(str)) {
    const [day, month, year] = str.split(".").map(Number)
    const d = new Date(year, month - 1, day)
    return isNaN(d.getTime()) ? null : d.getTime()
  }
  return null
}

function parseNum(str: string): number | undefined {
  if (!str || str.trim() === "") return undefined
  const n = parseFloat(str.replace(",", "."))
  return isNaN(n) ? undefined : n
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { rows: [], errors: ["Soubor je prázdný nebo nemá žádná data."] }

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim())
  const colIdx = (name: string) => header.indexOf(name)

  const errors: string[] = []
  const rows: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim())
    const lineNum = i + 1

    const dateStr = cells[colIdx("datum")] ?? ""
    const typeStr = (cells[colIdx("typ")] ?? "").toLowerCase()
    const amountStr = cells[colIdx("castka_czk")] ?? ""

    const date = parseDate(dateStr)
    if (!date) { errors.push(`Řádek ${lineNum}: neplatné datum "${dateStr}"`); continue }

    const amountCzk = parseNum(amountStr)
    if (amountCzk == null) { errors.push(`Řádek ${lineNum}: neplatná částka "${amountStr}"`); continue }

    rows.push({
      date,
      type: typeStr || "expense",
      amountCzk,
      liters: parseNum(cells[colIdx("litry")] ?? ""),
      pricePerLiter: parseNum(cells[colIdx("cena_za_litr")] ?? ""),
      odometerKmTotal: parseNum(cells[colIdx("tachometr_km")] ?? ""),
      note: cells[colIdx("poznamka")] || undefined,
    })
  }

  return { rows, errors }
}

export function ImportExportContent({ vehicleId }: Props) {
  const vehicle = useQuery(api.vehicles.getVehicle, { vehicleId })
  const expenses = useQuery(api.expenses.listExpenses, { vehicleId, limit: 9999 })
  const bulkImport = useMutation(api.expenses.bulkImportExpenses)

  // Import state
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ rows: any[]; errors: string[] } | null>(null)
  const [fileName, setFileName] = useState("")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [importError, setImportError] = useState("")

  // --- EXPORT ---
  function handleExport() {
    if (!expenses || expenses.length === 0) return

    const header = "datum,typ,castka_czk,litry,cena_za_litr,tachometr_km,vzdalenost_km,spotreba_l100km,poznamka"
    const rows = [...expenses]
      .sort((a, b) => a.date - b.date)
      .map((e) => {
        const datum = format(new Date(e.date), "yyyy-MM-dd", { locale: cs })
        return [
          datum,
          e.type,
          e.amountCzk,
          e.liters ?? "",
          e.pricePerLiter ?? "",
          e.odometerKmTotal ?? "",
          e.distanceKm ?? "",
          e.consumptionLPer100 ?? "",
          (e.note ?? "").replace(/,/g, ";"),
        ].join(",")
      })

    const csv = [header, ...rows].join("\n")
    downloadCsv(csv, `autouctenky-${vehicle?.name ?? "vozidlo"}-${format(new Date(), "yyyy-MM-dd")}.csv`)
  }

  // --- TEMPLATE DOWNLOAD ---
  function handleTemplate() {
    downloadCsv(CSV_TEMPLATE, "autouctenky-sablona.csv")
  }

  function downloadCsv(content: string, filename: string) {
    const bom = "\uFEFF" // UTF-8 BOM for Excel compatibility
    const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- FILE PICK ---
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setImportError("")

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCsv(text)
      setPreview(parsed)
      console.log("[import] parsed rows:", parsed.rows.length, "errors:", parsed.errors)
    }
    reader.readAsText(file, "utf-8")
  }

  // --- IMPORT ---
  async function handleImport() {
    if (!preview || preview.rows.length === 0) return
    setImporting(true)
    setImportError("")
    try {
      const res = await bulkImport({ vehicleId, rows: preview.rows })
      setResult(res)
      setPreview(null)
      setFileName("")
      if (fileRef.current) fileRef.current.value = ""
      console.log("[import] done:", res)
    } catch (err: any) {
      console.error("[import] error:", err)
      setImportError(err?.message ?? "Nastala chyba při importu.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Link
          href={`/app/v/${vehicleId}/vehicle`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Zpět na vozidlo
        </Link>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-exo2)" }}
        >
          Import &amp; Export
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stáhněte všechna data jako CSV nebo hromadně importujte záznamy.
        </p>
      </div>

      {/* EXPORT */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Download className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-exo2)" }}>
            Export dat
          </h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Stáhne všechny záznamy vozidla do souboru CSV kompatibilního s Excelem a Google Sheets.
          {expenses !== undefined && (
            <> Celkem {expenses.length} záznamů.</>
          )}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={!expenses || expenses.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Stáhnout CSV
          </button>
          <button
            onClick={handleTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors"
          >
            <Table2 className="w-4 h-4" />
            Stáhnout šablonu
          </button>
        </div>
      </section>

      {/* IMPORT */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
            <Upload className="w-4 h-4 text-success" />
          </div>
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-exo2)" }}>
            Import dat
          </h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Nahrajte CSV soubor se záznamy. Duplicitní záznamy (stejné datum, typ a částka) budou automaticky přeskočeny.
        </p>

        {/* Format info */}
        <div className="rounded-xl bg-secondary/50 border border-border p-3.5 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Formát CSV</p>
          <p className="text-xs text-muted-foreground font-mono leading-relaxed">
            datum, typ, castka_czk, litry, cena_za_litr, tachometr_km, poznamka
          </p>
          <p className="text-xs text-muted-foreground">
            Datum: <code className="bg-muted px-1 rounded">RRRR-MM-DD</code> nebo <code className="bg-muted px-1 rounded">D.M.RRRR</code>
            {" · "}Typy: {Object.keys(TYPE_LABELS).join(", ")}
          </p>
        </div>

        {/* File input */}
        <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all">
          <FileText className="w-8 h-8 text-muted-foreground/50" />
          <span className="text-sm text-muted-foreground">
            {fileName ? fileName : "Klikněte pro výběr CSV souboru"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        {/* Preview */}
        {preview && (
          <div className="space-y-3">
            {preview.errors.length > 0 && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3.5 space-y-1">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Chyby při parsování
                </p>
                {preview.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-destructive/80">{e}</p>
                ))}
              </div>
            )}

            {preview.rows.length > 0 && (
              <div className="rounded-xl bg-secondary/40 border border-border overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Náhled — {preview.rows.length} řádků k importu
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-3.5 py-2 text-muted-foreground font-medium">Datum</th>
                        <th className="text-left px-3.5 py-2 text-muted-foreground font-medium">Typ</th>
                        <th className="text-right px-3.5 py-2 text-muted-foreground font-medium">Částka</th>
                        <th className="text-left px-3.5 py-2 text-muted-foreground font-medium">Poznámka</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0">
                          <td className="px-3.5 py-2">
                            {format(new Date(row.date), "d. M. yyyy", { locale: cs })}
                          </td>
                          <td className="px-3.5 py-2">{TYPE_LABELS[row.type] ?? row.type}</td>
                          <td className="px-3.5 py-2 text-right font-medium">
                            {new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(row.amountCzk)}
                          </td>
                          <td className="px-3.5 py-2 text-muted-foreground truncate max-w-[120px]">
                            {row.note ?? "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.rows.length > 5 && (
                    <p className="px-3.5 py-2 text-xs text-muted-foreground border-t border-border/30">
                      … a dalších {preview.rows.length - 5} řádků
                    </p>
                  )}
                </div>
              </div>
            )}

            {importError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {importError}
              </p>
            )}

            <button
              onClick={handleImport}
              disabled={importing || preview.rows.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-success/15 text-success border border-success/30 text-sm font-semibold hover:bg-success/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Importuji…</>
              ) : (
                <><Upload className="w-4 h-4" /> Importovat {preview.rows.length} záznamů</>
              )}
            </button>
          </div>
        )}

        {/* Success */}
        {result && (
          <div className="flex items-start gap-3 rounded-xl bg-success/10 border border-success/30 p-3.5">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-success">Import dokončen</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Přidáno {result.imported} záznamů
                {result.skipped > 0 && <>, přeskočeno {result.skipped} duplicit</>}.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
