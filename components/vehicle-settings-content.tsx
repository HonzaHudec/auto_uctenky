"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  Users,
  UserMinus,
  Link2,
  Copy,
  RefreshCw,
  Trash2,
  Loader2,
  Crown,
  Car,
  LogOut,
  Check,
  QrCode,
  X,
  ArrowUpDown,
} from "lucide-react"
import { VehicleDetailsSection } from "@/components/vehicle-details-section"
import { VehicleRemindersSection } from "@/components/vehicle-reminders-section"
import { VehicleVignetteSection } from "@/components/vehicle-vignette-section"

interface Props {
  vehicleId: Id<"vehicles">
}

export function VehicleSettingsContent({ vehicleId }: Props) {
  const router = useRouter()

  const vehicle = useQuery(api.vehicles.getVehicle, { vehicleId })
  const members = useQuery(api.members.listMembers, { vehicleId })
  const myRole = useQuery(api.members.getMyRole, { vehicleId })
  const invites = useQuery(api.invites.listInvites, { vehicleId })

  const createInvite = useMutation(api.invites.createInvite)
  const revokeInvite = useMutation(api.invites.revokeInvite)
  const removeMember = useMutation(api.members.removeMember)
  const leaveVehicle = useMutation(api.members.leaveVehicle)
  const deleteVehicle = useMutation(api.vehicles.deleteVehicle)

  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isOwner = myRole === "owner"

  async function handleCreateInvite() {
    if (creatingInvite) return
    setCreatingInvite(true)
    try {
      await createInvite({ vehicleId, role: "driver" })
      toast.success("Pozvánka vytvořena")
    } catch (err: any) {
      toast.error(err.message ?? "Chyba")
    } finally {
      setCreatingInvite(false)
    }
  }

  async function handleCopyInvite(inviteId: string) {
    const origin = window.location.origin
    const url = `${origin}/app/invite/${inviteId}`
    await navigator.clipboard.writeText(url)
    setCopiedId(inviteId)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success("Odkaz zkopírován!")
  }

  async function handleRevokeInvite(inviteId: Id<"invites">) {
    try {
      await revokeInvite({ inviteId })
      toast.success("Pozvánka zrušena")
    } catch (err: any) {
      toast.error(err.message ?? "Chyba")
    }
  }

  async function handleRemoveMember(membershipId: Id<"vehicleMembers">, name: string) {
    try {
      await removeMember({ vehicleId, membershipId })
      toast.success(`${name} odebrán`)
    } catch (err: any) {
      toast.error(err.message ?? "Chyba")
    }
  }

  async function handleLeave() {
    try {
      await leaveVehicle({ vehicleId })
      toast.success("Opustil jsi vozidlo")
      router.replace("/app")
    } catch (err: any) {
      toast.error(err.message ?? "Nelze odejít — nejprve přidej jiného vlastníka")
    }
  }

  async function handleDeleteVehicle() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteVehicle({ vehicleId })
      toast.success("Vozidlo smazáno")
      router.replace("/app")
    } catch (err: any) {
      toast.error(err.message ?? "Chyba při mazání")
      setDeleting(false)
    }
  }

  if (vehicle === undefined || vehicle === null || members === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-6">
      {/* Vehicle header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Car className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-exo2)" }}
            >
              {vehicle?.name ?? "Vozidlo"}
            </h1>
            <p className="text-xs text-muted-foreground capitalize">
              {isOwner ? "Vlastník" : "Řidič"}
            </p>
          </div>
        </div>
      </div>

      {/* Vehicle Details */}
      <VehicleDetailsSection vehicle={vehicle} isOwner={isOwner} />

      {/* Reminders */}
      <VehicleRemindersSection vehicle={vehicle} isOwner={isOwner} />

      {/* Vignettes */}
      <VehicleVignetteSection
        vehicleId={vehicleId}
        vehicleSpz={vehicle.spz}
        isOwner={isOwner}
      />

      {/* Members */}
      <Section title="Členové" icon={<Users className="w-4 h-4" />}>
        <div className="space-y-2">
          {members?.map((member) => (
            <div
              key={member._id}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
            >
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 text-sm font-semibold">
                {(member.name ?? member.email ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {member.name ?? member.email ?? "Neznámý"}
                </p>
                {member.name && member.email && (
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {member.role === "owner" && (
                  <span className="flex items-center gap-1 text-xs text-fuel bg-fuel-muted rounded-md px-2 py-0.5">
                    <Crown className="w-3 h-3" />
                    Vlastník
                  </span>
                )}
                {isOwner && member.role !== "owner" && (
                  <button
                    onClick={() =>
                      handleRemoveMember(
                        member._id as Id<"vehicleMembers">,
                        member.name ?? member.email ?? "člena"
                      )
                    }
                    className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    title="Odebrat člena"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Invites (owner only) */}
      {isOwner && (
        <Section
          title="Pozvánky"
          icon={<Link2 className="w-4 h-4" />}
          action={
            <button
              onClick={handleCreateInvite}
              disabled={creatingInvite}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              {creatingInvite ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Nová pozvánka
            </button>
          }
        >
          {invites && invites.length > 0 ? (
            <div className="space-y-2">
              {invites.map((invite) => {
                const expiresDate = new Date(invite.expiresAt)
                const daysLeft = Math.ceil(
                  (invite.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <div
                    key={invite._id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          {invite._id.slice(-8)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {invite.uses}/{invite.maxUses} použití · platí {daysLeft}d
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopyInvite(invite._id)}
                        className="p-1.5 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                        title="Kopírovat odkaz"
                      >
                        {copiedId === invite._id ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(invite._id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        title="Zrušit pozvánku"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Žádné aktivní pozvánky — vytvořte novou
            </p>
          )}
        </Section>
      )}

      {/* Import / Export */}
      <Section title="Data" icon={<ArrowUpDown className="w-4 h-4" />}>
        <Link
          href={`/app/v/${vehicleId}/vehicle/import-export`}
          className="w-full flex items-center gap-2.5 p-3.5 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary/40 hover:border-primary/30 transition-all"
        >
          <ArrowUpDown className="w-4 h-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Import &amp; Export</p>
            <p className="text-xs text-muted-foreground">Stáhnout CSV nebo importovat záznamy</p>
          </div>
        </Link>
      </Section>

      {/* Danger zone */}
      <Section title="Zóna nebezpečí" icon={<Trash2 className="w-4 h-4 text-destructive" />}>
        <div className="space-y-2">
          {!isOwner && (
            <button
              onClick={handleLeave}
              className="w-full flex items-center gap-2.5 p-3.5 rounded-xl border border-border bg-card text-sm font-medium hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-all text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Opustit vozidlo
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-2.5 p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors text-left"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              Smazat vozidlo
            </button>
          )}
        </div>
      </Section>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5">
            <h2
              className="text-lg font-bold mb-2"
              style={{ fontFamily: "var(--font-exo2)" }}
            >
              Smazat vozidlo?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Smaže se vozidlo a všechna data. Tuto akci nelze vrátit.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary/40 transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={handleDeleteVehicle}
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

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
