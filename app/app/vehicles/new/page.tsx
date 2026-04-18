"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Car, ArrowRight, Loader2 } from "lucide-react"

export default function NewVehiclePage() {
  const createVehicle = useMutation(api.vehicles.createVehicle)
  const router = useRouter()
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || loading) return

    setLoading(true)
    try {
      const vehicleId = await createVehicle({ name: name.trim() })
      toast.success("Vozidlo bylo přidáno!")
      router.replace(`/app/v/${vehicleId}/dashboard`)
    } catch (err) {
      console.error("Create vehicle error:", err)
      toast.error("Nepodařilo se přidat vozidlo")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 items-center justify-center mb-4">
            <Car className="w-8 h-8 text-primary" />
          </div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: "var(--font-exo2)" }}
          >
            Přidat vozidlo
          </h1>
          <p className="text-muted-foreground text-sm">
            Jak se jmenuje vaše auto nebo přívěs?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80" htmlFor="vehicle-name">
              Název vozidla
            </label>
            <input
              id="vehicle-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Škoda Octavia, Firemní Ford…"
              className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground placeholder:text-muted-foreground transition-all text-base"
              autoFocus
              maxLength={50}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Vytvořit vozidlo
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
