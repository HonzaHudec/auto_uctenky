"use client"

import { use, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Car, Users, CheckCircle, XCircle, Loader2 } from "lucide-react"

export default function InvitePage({ params }: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = use(params)
  const invite = useQuery(api.invites.getInvite, {
    inviteId: inviteId as Id<"invites">,
  })
  const acceptInvite = useMutation(api.invites.acceptInvite)
  const router = useRouter()
  const [accepting, setAccepting] = useState(false)

  async function handleAccept() {
    if (accepting) return
    setAccepting(true)
    try {
      const vehicleId = await acceptInvite({ inviteId: inviteId as Id<"invites"> })
      toast.success(`Přidáni do ${invite?.vehicleName}!`)
      router.replace(`/app/v/${vehicleId}/dashboard`)
    } catch (err: any) {
      console.error("Accept invite error:", err)
      toast.error(err.message ?? "Nepodařilo se přijmout pozvánku")
      setAccepting(false)
    }
  }

  if (invite === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  const isInvalid = !invite || invite.isExpired || invite.isRevoked || invite.isFull

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card p-7 text-center shadow-2xl">
          {isInvalid ? (
            <>
              <XCircle className="w-14 h-14 text-destructive mx-auto mb-4" />
              <h1
                className="text-2xl font-bold mb-2"
                style={{ fontFamily: "var(--font-exo2)" }}
              >
                Pozvánka je neplatná
              </h1>
              <p className="text-muted-foreground text-sm mb-6">
                {invite?.isExpired && "Pozvánka vypršela."}
                {invite?.isRevoked && "Pozvánka byla zrušena."}
                {invite?.isFull && "Pozvánka dosáhla maximálního počtu použití."}
                {!invite && "Pozvánka nebyla nalezena."}
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 items-center justify-center mb-4">
                <Car className="w-8 h-8 text-primary" />
              </div>

              <h1
                className="text-2xl font-bold mb-1"
                style={{ fontFamily: "var(--font-exo2)" }}
              >
                Pozvánka do vozidla
              </h1>

              <p className="text-muted-foreground text-sm mb-5">
                Byl/a jste pozván/a do vozidla{" "}
                <strong className="text-foreground">{invite.vehicleName}</strong>
                {" "}jako{" "}
                <span className="text-primary font-medium">
                  {invite.role === "owner" ? "vlastník" : "řidič"}
                </span>
              </p>

              <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground mb-6">
                <Users className="w-3.5 h-3.5" />
                <span>Pozval vás: {invite.creatorName}</span>
              </div>

              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
              >
                {accepting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Přijmout pozvánku
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
