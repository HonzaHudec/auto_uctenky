"use client"

import { useState } from "react"
import { useAuthActions } from "@convex-dev/auth/react"
import { toast } from "sonner"
import { ArrowRight, Mail, Loader2 } from "lucide-react"

export function SignInForm() {
  const { signIn } = useAuthActions()
  const [step, setStep] = useState<"email" | "otp">("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || loading) return

    setLoading(true)
    try {
      await signIn("resend-otp", { email: email.trim() })
      setStep("otp")
      toast.success("Kód odeslán na " + email)
    } catch (err) {
      console.error("Email submit error:", err)
      toast.error("Nepodařilo se odeslat kód. Zkuste to znovu.")
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!otp.trim() || loading) return

    setLoading(true)
    try {
      await signIn("resend-otp", { email: email.trim(), code: otp.trim() })
      // Redirect handled by HomePageContent
    } catch (err) {
      console.error("OTP submit error:", err)
      toast.error("Nesprávný nebo vypršelý kód. Zkuste znovu.")
      setOtp("")
      setLoading(false)
    }
  }

  if (step === "email") {
    return (
      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80" htmlFor="email">
            E-mailová adresa
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vas@email.cz"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-input border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground placeholder:text-muted-foreground transition-all"
              autoComplete="email"
              autoFocus
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Pokračovat
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleOtpSubmit} className="space-y-4">
      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary/90">
        Kód jsme poslali na <strong>{email}</strong>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground/80" htmlFor="otp">
          Ověřovací kód
        </label>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="123456"
          className="w-full px-4 py-3 rounded-lg bg-input border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-center text-2xl font-mono tracking-widest placeholder:text-muted-foreground transition-all"
          autoFocus
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading || otp.length < 6}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Přihlásit se"
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          setStep("email")
          setOtp("")
        }}
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Změnit e-mail
      </button>
    </form>
  )
}
