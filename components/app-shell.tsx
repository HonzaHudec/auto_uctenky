"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthActions } from "@convex-dev/auth/react"
import { toast } from "sonner"
import {
  LayoutDashboard,
  Fuel,
  List,
  Car,
  ChevronDown,
  LogOut,
  Plus,
  Menu,
  X,
  BarChart2,
} from "lucide-react"

interface AppShellProps {
  vehicleId: Id<"vehicles">
  children: React.ReactNode
}

export function AppShell({ vehicleId, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuthActions()
  const vehicle = useQuery(api.vehicles.getVehicle, { vehicleId })
  const allVehicles = useQuery(api.vehicles.listMyVehicles)
  const user = useQuery(api.users.currentLoggedInUser)
  const [menuOpen, setMenuOpen] = useState(false)
  const [vehicleDropdown, setVehicleDropdown] = useState(false)

  const navItems = [
    {
      href: `/app/v/${vehicleId}/dashboard`,
      label: "Přehled",
      icon: LayoutDashboard,
    },
    {
      href: `/app/v/${vehicleId}/expenses`,
      label: "Záznamy",
      icon: List,
    },
    {
      href: `/app/v/${vehicleId}/costs`,
      label: "Náklady",
      icon: BarChart2,
    },
    {
      href: `/app/v/${vehicleId}/vehicle`,
      label: "Vozidlo",
      icon: Car,
    },
  ]

  function isActive(href: string) {
    if (href.endsWith("/dashboard")) return pathname === href
    if (href.endsWith("/expenses")) return pathname === href || pathname.includes("/expenses/")
    if (href.endsWith("/costs")) return pathname === href
    return pathname === href
  }

  async function handleSignOut() {
    await signOut()
    router.replace("/")
    toast.success("Odhlášení proběhlo úspěšně")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-card border-r border-border z-40">
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Fuel className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg" style={{ fontFamily: "var(--font-exo2)" }}>
              AutoÚčtenky
            </span>
          </div>
        </div>

        {/* Vehicle selector */}
        <div className="p-3 border-b border-border">
          <button
            onClick={() => setVehicleDropdown(!vehicleDropdown)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors text-left"
          >
            <Car className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium truncate">
              {vehicle?.name ?? "…"}
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${vehicleDropdown ? "rotate-180" : ""}`} />
          </button>

          {vehicleDropdown && (
            <div className="mt-1 space-y-0.5">
              {allVehicles?.filter((v): v is NonNullable<typeof v> => Boolean(v)).map((v) => (
                <Link
                  key={v._id}
                  href={`/app/v/${v._id}/dashboard`}
                  onClick={() => setVehicleDropdown(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    v._id === vehicleId
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-secondary/60"
                  }`}
                >
                  <span className="flex-1 truncate">{v.name}</span>
                  {v.role === "owner" && (
                    <span className="text-xs text-muted-foreground">owner</span>
                  )}
                </Link>
              ))}
              <Link
                href="/app/vehicles/new"
                onClick={() => setVehicleDropdown(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary/60 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Přidat vozidlo
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(href)
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Add fuel button */}
        <div className="p-3 border-t border-border">
          <Link
            href={`/app/v/${vehicleId}/expenses/new`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Fuel className="w-4 h-4" />
            Přidat tankování
          </Link>
        </div>

        {/* User */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary">
              {(user?.name ?? user?.email ?? "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.name ?? user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              title="Odhlásit se"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Fuel className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-base" style={{ fontFamily: "var(--font-exo2)" }}>
            {vehicle?.name ?? "AutoÚčtenky"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!pathname.includes("/expenses/new") && (
            <Link
              href={`/app/v/${vehicleId}/expenses/new`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Výdaj
            </Link>
          )}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg hover:bg-secondary/60 transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-background/90 backdrop-blur"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-0 right-0 w-72 h-full bg-card border-l border-border p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold" style={{ fontFamily: "var(--font-exo2)" }}>Menu</span>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary/60">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vehicle list */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">Vozidla</p>
              {allVehicles?.filter((v): v is NonNullable<typeof v> => Boolean(v)).map((v) => (
                <Link
                  key={v._id}
                  href={`/app/v/${v._id}/dashboard`}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors ${
                    v._id === vehicleId ? "bg-primary/15 text-primary" : "hover:bg-secondary/60"
                  }`}
                >
                  <Car className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{v.name}</span>
                </Link>
              ))}
              <Link
                href="/app/vehicles/new"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary/60 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Přidat vozidlo
              </Link>
            </div>

            <div className="flex-1" />

            {/* User + sign out */}
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground truncate px-1 mb-2">{user?.email}</p>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors w-full"
              >
                <LogOut className="w-4 h-4" />
                Odhlásit se
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-60 pt-14 lg:pt-0 pb-20 lg:pb-0 flex-1">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border bottom-nav">
        <div className="flex items-center justify-around px-2 pt-2 pb-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                isActive(href) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
