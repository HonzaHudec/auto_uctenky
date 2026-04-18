"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react"
import { SignInForm } from "@/components/sign-in-form"
import { Fuel, Receipt, Users, TrendingUp } from "lucide-react"

export function HomePageContent() {
  const { isLoading } = useConvexAuth()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-accent/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-48 bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-6 pt-8 pb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Fuel className="w-5 h-5 text-primary-foreground" />
          </div>
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-exo2)" }}
          >
            AutoÚčtenky
          </span>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 px-6 py-8 max-w-6xl mx-auto w-full">
          {/* Hero section */}
          <div className="flex-1 text-center lg:text-left max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Sdílené vozidlo, jasné účty
            </div>

            <h1
              className="text-4xl lg:text-5xl font-bold leading-tight mb-4"
              style={{ fontFamily: "var(--font-exo2)" }}
            >
              Výdaje na auto
              <br />
              <span className="text-primary">pod kontrolou</span>
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              Fotíte účtenky a aplikace sama rozezná datum, litry a cenu.
              Přidejte spolujezdce a mějte přehled, kdo za co zaplatil.
            </p>

            {/* Feature pills */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { icon: Receipt, text: "OCR z účtenky" },
                { icon: Fuel, text: "Spotřeba a km" },
                { icon: Users, text: "Sdílení s partou" },
                { icon: TrendingUp, text: "Přehledné statistiky" },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-secondary/60 border border-border/50 text-foreground/80"
                >
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auth card */}
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-7 shadow-2xl glow-blue">
              <Unauthenticated>
                <h2
                  className="text-2xl font-bold mb-1"
                  style={{ fontFamily: "var(--font-exo2)" }}
                >
                  Přihlásit se
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Zadejte svůj e-mail, pošleme vám kód
                </p>
                <SignInForm />
              </Unauthenticated>

              <Authenticated>
                <AuthenticatedRedirect />
              </Authenticated>

              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="text-center text-muted-foreground/50 text-xs py-6 px-4">
          Účtenky jsou automaticky mazány po 30 dnech
        </footer>
      </div>
    </div>
  )
}

function AuthenticatedRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/app")
  }, [router])

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Přihlašování…</p>
    </div>
  )
}
